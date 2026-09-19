import { h, clear, toast } from './dom';
import { panel, stepList, verdictBox, type AppCtx } from './shared';
import { concat, exportPublic, generateKeyPair, sha256, sign, u32 } from '../engine/crypto';
import {
  BODY_LEN, MAX_STATUS_AGE_DAYS, STATUS_LEN, currentBucket, dayNumber,
  encodeBody, issueStatus, makeProof, serialHex, verifyProof,
  type CredentialFields, type StatusToken,
} from '../engine/credential';
import { onEntitledRoute } from '../engine/entitlement';
import { revokeStudent } from '../engine/world';
import { deviceClock } from '../engine/clock';
import { DEPOTS } from '../data/depots';

interface Attack {
  key: string;
  title: string;
  detail: string;
  build: (ctx: AppCtx) => Promise<{ proof: Uint8Array; serviceClass?: string; boardingDepot?: number; nowMs?: number; clockNote?: string }>;
}

const ATTACKS: Attack[] = [
  {
    key: 'honest',
    title: 'An honest pass',
    detail: 'The control. A real student, a live proof, a covered service on the entitled route.',
    build: async (ctx) => {
      const s = ctx.world.students[0];
      return { proof: await makeProof(s.credential, s.status, s.deviceKeys.privateKey, deviceClock.now()), boardingDepot: s.homeDepot };
    },
  },
  {
    key: 'screenshot',
    title: 'A screenshot sent to a friend',
    detail: 'The most common real-world fraud. A proof minted nine minutes ago, presented now.',
    build: async (ctx) => {
      const s = ctx.world.students[0];
      return {
        proof: await makeProof(s.credential, s.status, s.deviceKeys.privateKey, deviceClock.now() - 9 * 60_000),
        boardingDepot: s.homeDepot,
      };
    },
  },
  {
    key: 'transplant',
    title: 'A friend copies the credential into their own app',
    detail: 'Same signed credential, but the proof is signed by a different device key.',
    build: async (ctx) => {
      const s = ctx.world.students[0];
      const impostor = await generateKeyPair(true);
      const bodyHash = await sha256(concat(s.credential.body, s.credential.issuerSignature));
      const bucket = currentBucket(deviceClock.now());
      const badSig = await sign(impostor.privateKey, concat(bodyHash, u32(s.status.day), u32(bucket)));
      return {
        proof: concat(
          s.credential.body, s.credential.issuerSignature,
          u32(s.status.day), s.status.signature, u32(bucket), badSig,
        ),
        boardingDepot: s.homeDepot,
      };
    },
  },
  {
    key: 'tamper',
    title: 'Editing the expiry date',
    detail: 'A graduated student pushes the validity out by a year and re-renders the QR.',
    build: async (ctx) => {
      const s = ctx.world.students[1];
      const fields: CredentialFields = { ...s.credential.fields, validToDay: s.credential.fields.validToDay + 365 };
      const body = encodeBody(fields);
      const proof = await makeProof(s.credential, s.status, s.deviceKeys.privateKey, deviceClock.now());
      const forged = concat(body, proof.slice(BODY_LEN));
      return { proof: forged, boardingDepot: s.homeDepot };
    },
  },
  {
    key: 'forge',
    title: 'A fake college issues itself passes',
    detail: 'A complete, internally consistent credential — signed by a key the authority never countersigned.',
    build: async (ctx) => {
      const rogueInst = await generateKeyPair(true);
      const device = await generateKeyPair(true);
      const devicePublicRaw = await exportPublic(device.publicKey);
      const real = ctx.world.students[0].credential.fields;
      const fields: CredentialFields = { ...real, devicePublicRaw };
      const body = encodeBody(fields);
      const issuerSig = await sign(rogueInst.privateKey, body);
      const day = dayNumber(deviceClock.now());
      const status: StatusToken = await issueStatus(rogueInst.privateKey, fields.serial, day);
      const bucket = currentBucket(deviceClock.now());
      const bodyHash = await sha256(concat(body, issuerSig));
      const devSig = await sign(device.privateKey, concat(bodyHash, u32(day), u32(bucket)));
      return {
        proof: concat(body, issuerSig, u32(day), status.signature, u32(bucket), devSig),
        boardingDepot: ctx.world.students[0].homeDepot,
      };
    },
  },
  {
    key: 'revoked',
    title: 'A pass revoked this morning',
    detail: 'The institution revoked it and re-signed the same-day emergency list. The bus has never been online since.',
    build: async (ctx) => {
      const s = ctx.world.students[5];
      if (!s.revoked) await revokeStudent(ctx.world, s);
      return { proof: await makeProof(s.credential, s.status, s.deviceKeys.privateKey, deviceClock.now()), boardingDepot: s.homeDepot };
    },
  },
  {
    key: 'class',
    title: 'A covered student boards a super fast',
    detail: 'A genuine pass, used on a class of service the concession does not cover.',
    build: async (ctx) => {
      const s = ctx.world.students[1];
      return {
        proof: await makeProof(s.credential, s.status, s.deviceKeys.privateKey, deviceClock.now()),
        serviceClass: 'Super fast',
        boardingDepot: s.homeDepot,
      };
    },
  },
  {
    key: 'stalestatus',
    title: 'A pass that stopped checking in',
    detail: `A genuine, live proof whose institution last confirmed it more than ${MAX_STATUS_AGE_DAYS} days ago. This is how a revoked pass dies without any list reaching the bus.`,
    build: async (ctx) => {
      const s = ctx.world.students[5];
      const stale = await issueStatus(
        ctx.world.institutions.find((i) => i.code === s.institutionCode)!.privateKey!,
        s.credential.fields.serial,
        dayNumber(deviceClock.now()) - (MAX_STATUS_AGE_DAYS + 4),
      );
      return {
        proof: await makeProof(s.credential, stale, s.deviceKeys.privateKey, deviceClock.now()),
        boardingDepot: s.homeDepot,
      };
    },
  },
  {
    key: 'statusforge',
    title: 'A student re-dates their own status token',
    detail: `Same pass, status day rewritten to today \u2014 but the ${STATUS_LEN}-byte token carries the institution's signature over that exact day.`,
    build: async (ctx) => {
      const s = ctx.world.students[5];
      const today = dayNumber(deviceClock.now());
      const forged: StatusToken = { day: today, signature: s.status.signature };
      return {
        proof: await makeProof(s.credential, forged, s.deviceKeys.privateKey, deviceClock.now()),
        boardingDepot: s.homeDepot,
      };
    },
  },
  {
    key: 'clockskew',
    title: 'The conductor\u2019s phone clock is nine minutes fast',
    detail: 'Not an attack \u2014 an ordinary failure. Without a synced time beacon the scanner rejects a perfectly valid pass.',
    build: async (ctx) => {
      const s = ctx.world.students[0];
      const proof = await makeProof(s.credential, s.status, s.deviceKeys.privateKey, Date.now());
      return {
        proof,
        boardingDepot: s.homeDepot,
        nowMs: Date.now() + 9 * 60_000,
        clockNote: 'This scanner has no synced depot time and is trusting its own clock.',
      };
    },
  },
  {
    key: 'clockfixed',
    title: 'The same wrong clock, after a depot sync',
    detail: 'The device tells time by the authority\u2019s signed timestamp plus its own monotonic counter, so the wrong wall clock stops mattering.',
    build: async (ctx) => {
      const s = ctx.world.students[0];
      return {
        proof: await makeProof(s.credential, s.status, s.deviceKeys.privateKey, Date.now()),
        boardingDepot: s.homeDepot,
        nowMs: Date.now(),
        clockNote: 'Operating-system clock is 9 min fast; synced depot time was used instead.',
      };
    },
  },
  {
    key: 'offroute',
    title: 'A weekend trip across the state',
    detail: 'A genuine, live pass — boarding 200 km off the registered home-to-college route.',
    build: async (ctx) => {
      const s = ctx.world.students[0];
      return {
        proof: await makeProof(s.credential, s.status, s.deviceKeys.privateKey, deviceClock.now()),
        boardingDepot: DEPOTS.findIndex((d) => d.code === 'TVM'),
      };
    },
  },
];

export function benchView(ctx: AppCtx): HTMLElement {
  const resultHost = h('div', { class: 'panel__body' });

  async function run(attack: Attack): Promise<void> {
    const built = await attack.build(ctx);
    const result = await verifyProof(built.proof, {
      trust: ctx.world.trust,
      revocations: ctx.world.revocations,
      nowMs: built.nowMs ?? deviceClock.now(),
      clockNote: built.clockNote,
      serviceClass: (built.serviceClass ?? 'Ordinary') as never,
      boardingDepot: built.boardingDepot,
      routeCheck: onEntitledRoute,
    });
    clear(resultHost);
    resultHost.appendChild(h('div', { class: 'eyebrow' }, attack.title));
    resultHost.appendChild(verdictBox(result, `${built.proof.length} bytes examined`));
    resultHost.appendChild(stepList(result, true));
    if (result.fields) {
      resultHost.appendChild(h('p', { class: 'note' }, `Serial ${serialHex(result.fields)}.`));
    }
    toast(result.accepted ? 'Accepted.' : 'Rejected, with a reason.');
  }

  const list = h('div', { class: 'attacks' });
  for (const attack of ATTACKS) {
    list.appendChild(
      h(
        'div',
        { class: 'attack' },
        h('div', { class: 'attack__text' },
          h('div', { class: 'attack__title' }, attack.title),
          h('div', { class: 'attack__detail' }, attack.detail)),
        h('button', {
          class: attack.key === 'honest' ? 'btn btn--sm' : 'btn btn--ghost btn--sm',
          type: 'button',
          onclick: () => void run(attack),
        }, 'Try it'),
      ),
    );
  }

  clear(resultHost);
  resultHost.appendChild(
    h('p', { class: 'lede' },
      'Every attempt below is built out of real keys and real signatures at the moment you press the button, and ' +
      'checked by the same verifier the conductor screen uses. Nothing is scripted to fail.'),
  );

  return h(
    'div',
    { class: 'grid grid--work' },
    panel('Attack bench', 'Try to break it', h('div', { class: 'panel__body' }, list,
      h('p', { class: 'note' },
        'The revoked-pass case actually revokes that student, so the institution console and the scanner will agree with it afterwards.'))),
    panel('What the scanner decided', 'Result', resultHost),
  );
}
