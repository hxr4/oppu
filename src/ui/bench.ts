import { h, clear, toast } from './dom';
import { panel, stepList, verdictBox, type AppCtx } from './shared';
import { concat, exportPublic, generateKeyPair, sha256, sign, u32 } from '../engine/crypto';
import {
  BODY_LEN, SIG_LEN, currentBucket, encodeBody, makeProof, serialHex, verifyProof,
  type CredentialFields,
} from '../engine/credential';
import { onEntitledRoute } from '../engine/entitlement';
import { revokeStudent } from '../engine/world';
import { DEPOTS } from '../data/depots';

interface Attack {
  key: string;
  title: string;
  detail: string;
  build: (ctx: AppCtx) => Promise<{ proof: Uint8Array; serviceClass?: string; boardingDepot?: number }>;
}

const ATTACKS: Attack[] = [
  {
    key: 'honest',
    title: 'An honest pass',
    detail: 'The control. A real student, a live proof, a covered service on the entitled route.',
    build: async (ctx) => {
      const s = ctx.world.students[0];
      return { proof: await makeProof(s.credential, s.deviceKeys.privateKey, Date.now()), boardingDepot: s.homeDepot };
    },
  },
  {
    key: 'screenshot',
    title: 'A screenshot sent to a friend',
    detail: 'The most common real-world fraud. A proof minted nine minutes ago, presented now.',
    build: async (ctx) => {
      const s = ctx.world.students[0];
      return {
        proof: await makeProof(s.credential, s.deviceKeys.privateKey, Date.now() - 9 * 60_000),
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
      const bucket = currentBucket(Date.now());
      const badSig = await sign(impostor.privateKey, concat(bodyHash, u32(bucket)));
      return {
        proof: concat(s.credential.body, s.credential.issuerSignature, u32(bucket), badSig),
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
      const proof = await makeProof(s.credential, s.deviceKeys.privateKey, Date.now());
      const forged = concat(body, proof.slice(BODY_LEN, BODY_LEN + SIG_LEN), proof.slice(BODY_LEN + SIG_LEN));
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
      const bucket = currentBucket(Date.now());
      const bodyHash = await sha256(concat(body, issuerSig));
      const devSig = await sign(device.privateKey, concat(bodyHash, u32(bucket)));
      return { proof: concat(body, issuerSig, u32(bucket), devSig), boardingDepot: ctx.world.students[0].homeDepot };
    },
  },
  {
    key: 'revoked',
    title: 'A pass revoked this morning',
    detail: 'The institution revoked it and re-signed the digest. The bus has never been online since.',
    build: async (ctx) => {
      const s = ctx.world.students[5];
      if (!s.revoked) await revokeStudent(ctx.world, s);
      return { proof: await makeProof(s.credential, s.deviceKeys.privateKey, Date.now()), boardingDepot: s.homeDepot };
    },
  },
  {
    key: 'class',
    title: 'A covered student boards a super fast',
    detail: 'A genuine pass, used on a class of service the concession does not cover.',
    build: async (ctx) => {
      const s = ctx.world.students[1];
      return {
        proof: await makeProof(s.credential, s.deviceKeys.privateKey, Date.now()),
        serviceClass: 'Super fast',
        boardingDepot: s.homeDepot,
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
        proof: await makeProof(s.credential, s.deviceKeys.privateKey, Date.now()),
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
      nowMs: Date.now(),
      serviceClass: (built.serviceClass ?? 'Ordinary') as never,
      boardingDepot: built.boardingDepot,
      routeCheck: onEntitledRoute,
    });
    clear(resultHost);
    resultHost.appendChild(h('div', { class: 'eyebrow' }, attack.title));
    resultHost.appendChild(verdictBox(result, `${built.proof.length} bytes examined`));
    resultHost.appendChild(stepList(result));
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
