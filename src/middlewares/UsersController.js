const bip39 = require("bip39");
const bitcore = require("bitcore-lib");
const model = require("../database/models").user;
const wallet = require("../database/models").wallet;
const rawuser = require("../database/models").rawuser;
const AuthController = require("./library/AuthController");
const BitcoinController = require("./library/BitcoinController");
const EthereumController = require("./library/EthereumController");

const Controller = { ...AuthController };

Controller.model = model;

Controller.authKey = "user";

Controller.createInclude = "wallets";

Controller.readInclude = [
  "orders",
  "referrals",
  "transactions",
  {
    model: wallet,
    as: "btc_wallets",
    required: false,
    where: {
      type: 1,
    },
  },
  {
    model: wallet,
    as: "eth_wallets",
    required: false,
    where: {
      type: 2,
    },
  },
  {
    model: wallet,
    as: "usdt_wallets",
    required: false,
    where: {
      type: 3,
    },
  },
];

Controller.readOrder = [
  [{ model: wallet, as: "btc_wallets" }, "createdAt", "DESC"],
  [{ model: wallet, as: "eth_wallets" }, "createdAt", "DESC"],
  [{ model: wallet, as: "usdt_wallets" }, "createdAt", "DESC"],
];

Controller.createBody = function (body) {
  const phrase = bip39.generateMnemonic();
  const usdt_phrase = bip39.generateMnemonic();

  const seed = bip39.mnemonicToSeedSync(phrase);
  const seed2 = bip39.mnemonicToSeedSync(usdt_phrase);

  const root = bitcore.HDPrivateKey.fromSeed(seed);
  const root2 = bitcore.HDPrivateKey.fromSeed(seed);
  const root3 = bitcore.HDPrivateKey.fromSeed(seed2);

  const bitcoin = root.derive("m/44'/1'/0'/0");
  const ethereum = root2.derive("m/44'/60'/0'/0");
  const tether = root3.derive("m/44'/60'/0'/0");

  const btc_xpub = bitcoin.xpubkey;
  const btc_address = bitcoin.derive(0).privateKey.toAddress().toString();

  const eth_xpub = ethereum.xpubkey;
  const eth_address = EthereumController.create(eth_xpub, 0);

  const usdt_xpub = tether.xpubkey;
  const usdt_address = EthereumController.create(usdt_xpub, 0);

  return {
    ...body,
    phrase,
    usdt_phrase,
    btc_xpub,
    eth_xpub,
    usdt_xpub,
    wallets: [
      { address: btc_address, type: 1, path: 0, label: "Default BTC Wallet" },
      { address: eth_address, type: 2, path: 0, label: "Default ETH Wallet" },
      { address: usdt_address, type: 3, path: 1, label: "Default USDT Wallet" },
    ],
  };
};

Controller.createBtc = async function (request, response) {
  const errors = [];
  const { user } = request.session;
  const { label, path } = request.body;

  if (label === undefined) {
    errors.push("label is required");
  }

  if (path === undefined) {
    errors.push("path is required");
  }

  if (errors.length) {
    return response.json({ errors, data: {}, message: "" });
  }

  const address = BitcoinController.create(user.btc_xpub, path);

  const user_id = user.id;

  await wallet.create({ type: 1, user_id, path, label, address });

  const data = await this.model.findOne({
    where: { id: user_id },
    order: this.readOrder,
    include: this.readInclude,
  });

  return response.json({ errors, data, message: "" });
};

Controller.createEth = async function (request, response) {
  const errors = [];
  const { user } = request.session;
  const { label, path } = request.body;

  if (label === undefined) {
    errors.push("label is required");
  }

  if (path === undefined) {
    errors.push("path is required");
  }

  if (errors.length) {
    return response.json({ errors, data: {}, message: "" });
  }

  const address = EthereumController.create(user.eth_xpub, path);

  const user_id = user.id;

  await wallet.create({ type: 2, user_id, path, label, address });

  const data = await this.model.findOne({
    where: { id: user_id },
    order: this.readOrder,
    include: this.readInclude,
  });

  return response.json({ errors, data, message: "" });
};

Controller.createUsdt = async function (request, response) {
  const errors = [];
  const { user } = request.session;
  const { label, path } = request.body;

  if (label === undefined) {
    errors.push("label is required");
  }

  if (path === undefined) {
    errors.push("path is required");
  }

  if (errors.length) {
    return response.json({ errors, data: {}, message: "" });
  }

  const address = EthereumController.create(user.usdt_xpub, path);

  const user_id = user.id;

  await wallet.create({ type: 3, user_id, path, label, address });

  const data = await this.model.findOne({
    where: { id: user_id },
    order: this.readOrder,
    include: this.readInclude,
  });

  return response.json({ errors, data, message: "" });
};

Controller.sendBtc = async function (request, response) {
  const { user } = request.session;
  let { amount, address, from, fee } = request.body;

  const RawUser = await rawuser.findOne({ where: { id: user.id } });

  amount = parseFloat(amount);

  const to = address.trim();

  const sats = Math.round(amount * 100000000);

  froma = BitcoinController.create(user.btc_xpub, from);

  if (froma == to) {
    return response.json({
      errors: ["you should not be sending bitcoins to yourself"],
      data: {},
      message: "",
    });
  }

  const isValidAddress = BitcoinController.validate(to);

  if (!isValidAddress) {
    return response.json({
      errors: ["Invalid Bitcoin Address"],
      data: {},
      message: "",
    });
  }

  // try {
  const pk = BitcoinController.getPrivateKey(RawUser.dataValues.phrase, from);

  const unspent = await BitcoinController.getUnspent(froma, sats);

  // prettier-ignore
  const tx = BitcoinController.createTransaction(unspent, froma, to, sats, pk, fee);

  const res = await BitcoinController.broadcast(tx);

  if (res) {
    if (res.success) {
      this.sendEmail(
        user.email,
        `You have successfuly sent ${amount} BTC to ${to} `,
        "Bitcoins Sent"
      );

      return response.json({
        errors: [],
        message: "",
        data: { txid: res.txid },
      });
    }
  }
  return response.json({
    data: {},
    message: "",
    errors: [res.error.message],
  });
};

Controller.sendEth = async function (request, response) {
  const { user } = request.session;

  let { amount, address, from } = request.body;

  const from_address = EthereumController.create(user.eth_xpub, from);

  const RawUser = await rawuser.findOne({ where: { id: user.id } });

  const privateKey = EthereumController.getPrivateKey(
    RawUser.dataValues.phrase,
    from
  );

  // prettier-ignore
  const transaction = await EthereumController.createTransaction(from_address,address,amount,privateKey);

  // try {
  const res = await EthereumController.broadcast(transaction);

  if (res.errors.length === 0) {
    this.sendEmail(
      user.email,
      `You have successfuly sent ${amount} ETH to ${address} `,
      "Ethers Sent"
    );
  }

  return response.json(res);
};

Controller.sendUsdt = async function (request, response) {
  const { user } = request.session;

  let { amount, address, from } = request.body;

  const from_address = EthereumController.create(user.usdt_xpub, from);

  const RawUser = await rawuser.findOne({ where: { id: user.id } });

  const privateKey = EthereumController.getPrivateKey(
    RawUser.dataValues.usdt_phrase,
    from
  );

  // prettier-ignore
  const transaction = await EthereumController.createUsdtTx(from_address,address,amount,privateKey);

  // try {
  const res = await EthereumController.broadcast(transaction);

  if (res.errors.length === 0) {
    this.sendEmail(
      user.email,
      `You have successfuly sent ${amount} USDT to ${address} `,
      "Tethers Sent"
    );
  }

  return response.json(res);
};

// Controller.sendUsdt = async function (request, response) {
//   const errors = [];
//   const { user } = request.session;
//   let { amount, address, from } = request.body;

//   if (amount === undefined) {
//     errors.push("amount is required");
//   }

//   if (address === undefined) {
//     errors.push("address is required");
//   }

//   if (from === undefined) {
//     errors.push("from is required");
//   }

//   if (errors.length) {
//     return response.json({ errors, data: {}, message: "" });
//   }

//   const from_address = EthereumController.create(user.usdt_xpub, from);

//   const privateKey = EthereumController.getPrivateKey(user.usdt_phrase, from);

//   // prettier-ignore
//   const transaction = await EthereumController.createUsdtTx(from_address,address,amount,privateKey);

//   console.log(transaction);

//   try {
//     const res = await EthereumController.broadcast(transaction);
//     return response.json(res);
//   } catch (error) {
//     console.log("brd error", error);
//     return response.json({
//       errors: ["broadcast error"],
//       data: {},
//       message: "",
//     });
//   }
// };

for (let key in Controller) {
  if (typeof Controller[key] == "function" && key != "model") {
    Controller[key] = Controller[key].bind(Controller);
  }
}

module.exports = Controller;