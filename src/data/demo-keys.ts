/**
 * Published demo trust-root keys.
 *
 * These ECDSA P-256 keys are intentionally embedded in the demo so that
 * every browser/device shares the same trust root and institutional keys.
 *
 * DEMO ONLY:
 * These private keys are intentionally published and must never be reused
 * for production credentials, institutional identities, or real signing.
 */

export const DEMO_ROOT = {
  priv: {
    crv: "P-256",
    d: "J4sb2D2V1463kKZyRtKBNmv4dWB6AoORg7r929sdHX8",
    ext: true,
    key_ops: ["sign"],
    kty: "EC",
    x: "1SIdnRKInQa02CPFJNCdCktjX6Ba3ufhwoEPstlDZi0",
    y: "fKPcVawwKShdoyoDgpHKYYOiMDRBCs2CJ79xu5Nojio",
  },
  pub: {
    crv: "P-256",
    ext: true,
    key_ops: ["verify"],
    kty: "EC",
    x: "1SIdnRKInQa02CPFJNCdCktjX6Ba3ufhwoEPstlDZi0",
    y: "fKPcVawwKShdoyoDgpHKYYOiMDRBCs2CJ79xu5Nojio",
  },
} satisfies {
  priv: JsonWebKey;
  pub: JsonWebKey;
};

export const DEMO_INSTITUTIONS = {
  CHT: {
    priv: {
      crv: "P-256",
      d: "mxFDywhe-W3JkMbc7MGtmAfZZsIGfKW_0kClTFGdIkc",
      ext: true,
      key_ops: ["sign"],
      kty: "EC",
      x: "dAkq5prAuj2nXC503ek13kVjBADhejrNV3Muq7JmPY4",
      y: "MBhOgZCr7_QcoH2UDX4g4Xq8989fgBt3FkSI9sU1bf4",
    },
    pub: {
      crv: "P-256",
      ext: true,
      key_ops: ["verify"],
      kty: "EC",
      x: "dAkq5prAuj2nXC503ek13kVjBADhejrNV3Muq7JmPY4",
      y: "MBhOgZCr7_QcoH2UDX4g4Xq8989fgBt3FkSI9sU1bf4",
    },
  },

  NLP: {
    priv: {
      crv: "P-256",
      d: "4ML58Wo7fPu6cJPHm1NW63237n0NNvrb2X1OvKbzGoQ",
      ext: true,
      key_ops: ["sign"],
      kty: "EC",
      x: "Gbq5ZBx4gnembemEeDvFs_O7fShx81zYcbbvdslPYzE",
      y: "Q0Yu6AdSdQHh9X7-7xMsFqCdf3MtVfoAa2fe_-Itp7o",
    },
    pub: {
      crv: "P-256",
      ext: true,
      key_ops: ["verify"],
      kty: "EC",
      x: "Gbq5ZBx4gnembemEeDvFs_O7fShx81zYcbbvdslPYzE",
      y: "Q0Yu6AdSdQHh9X7-7xMsFqCdf3MtVfoAa2fe_-Itp7o",
    },
  },

  PLM: {
    priv: {
      crv: "P-256",
      d: "ALgKjxgj-3Obd98YcrX1whCbDbIow20ZXsmqXaFUyMY",
      ext: true,
      key_ops: ["sign"],
      kty: "EC",
      x: "KlXr_oA20mD1N-X7VLd0AEBV1Vju70ZBC5IrQww-tS4",
      y: "dfzJBHC_XifXwqfq0eFgIQJMAlI7_o6o5k_MpvlqAyE",
    },
    pub: {
      crv: "P-256",
      ext: true,
      key_ops: ["verify"],
      kty: "EC",
      x: "KlXr_oA20mD1N-X7VLd0AEBV1Vju70ZBC5IrQww-tS4",
      y: "dfzJBHC_XifXwqfq0eFgIQJMAlI7_o6o5k_MpvlqAyE",
    },
  },

  VYN: {
    priv: {
      crv: "P-256",
      d: "qh-NPibECo5MXocNOxppqsQvVwz5Tc8HmJdZefONjQE",
      ext: true,
      key_ops: ["sign"],
      kty: "EC",
      x: "vqVQyl6jyPvJFhaWQOIQ2yNZeJTftnwOLHfGg9qYKzg",
      y: "gzuot_J6jeG4RaWr0vZlgT0Tj5xjusKBCSy0RshZ2B0",
    },
    pub: {
      crv: "P-256",
      ext: true,
      key_ops: ["verify"],
      kty: "EC",
      x: "vqVQyl6jyPvJFhaWQOIQ2yNZeJTftnwOLHfGg9qYKzg",
      y: "gzuot_J6jeG4RaWr0vZlgT0Tj5xjusKBCSy0RshZ2B0",
    },
  },
} satisfies Record<
  "CHT" | "NLP" | "PLM" | "VYN",
  {
    priv: JsonWebKey;
    pub: JsonWebKey;
  }
>;