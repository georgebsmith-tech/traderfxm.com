import React from "react";
import { sendRequestThenDispatch } from "hooks";
import FormComponent from "components/FormComponent";
import TourContainerComponent from "components/container/TourContainerComponent";

const format = (currency, amount) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
  return formatter.format(amount);
};

function BuyFormPage({ history, location }) {
  const { request, callBack, state } = sendRequestThenDispatch();

  let Container = TourContainerComponent;

  const { user } = state;
  const params = new URLSearchParams(location.search);
  const initialCurrency = params.get("currency") || "BTC";

  let cryptoId = 1;

  if (initialCurrency == "ETH") {
    cryptoId = 2;
  }

  if (initialCurrency == "USDT") {
    cryptoId = 3;
  }

  let initialState = {
    cryptoId,
  };

  if (user) {
    let address = user.btc_wallets[0].address;

    if (initialCurrency == "ETH") {
      address = user.eth_wallets[0].address;
    }

    if (initialCurrency == "USDT") {
      address = user.usdt_wallets[0].address;
    }

    initialState = {
      cryptoId,
      address,
      user_id: user.id,
      email: user.email,
      phone_number: user.phone_number,
    };
  }

  const { fetching, errors, message } = request;

  const btcprice = state.prices.bitcoin.usd;
  const ethprice = state.prices.ethereum.usd;

  const [worth, setWorth] = React.useState(0);
  const [crypto, setCrypto] = React.useState(0);
  const [amount, setAmount] = React.useState(0);
  const [currency, setCurrency] = React.useState(initialCurrency);

  let name = "bitcoin";

  if (currency == "ETH") {
    name = "ethereum";
  }

  const onChangeCallBack = ({ cryptoId, amount_in_ngn = 0 }) => {
    setAmount(amount_in_ngn);

    let worth = amount_in_ngn / 360;
    setWorth(worth);

    if (cryptoId == 1) {
      setCurrency("BTC");
      setCrypto((worth / btcprice).toFixed(8));
    }
    if (cryptoId == 2) {
      setCurrency("ETH");
      setCrypto((worth / ethprice).toFixed(8));
    }
  };

  const nav = [
    {
      label: "Buy Crypto",
    },
  ];

  const formArray = [
    {
      id: "cryptoId",
      label: "Crypto Currency",
      type: "select",
      options: [
        {
          value: 1,
          label: "Bitcoin",
        },
        {
          value: 2,
          label: "Ethereum",
        },
        {
          value: 3,
          label: "Tether",
        },
      ],
    },
    {
      id: "amount_in_ngn",
      label: "amount",
      type: "number",
      min: 1000,
      prefix: "NGN",
    },
    {
      type: "component",
      component: (
        <div key="message">
          <p>
            Rate: <s>N</s>
            360 = $1
          </p>
          <p>
            <s>N</s>
            {amount} = {format("USD", worth)} = {crypto} {currency}
          </p>
        </div>
      ),
    },
    {
      id: "address",
      label: "Wallet Address",
    },
    {
      id: "phone_number",
    },
    {
      id: "email",
    },
  ];

  const onSuccess = ({ reference }) => {
    history.push(`/transactions/${reference}`);
  };

  const onSubmit = (body) => {
    body.crypto_price = state.prices[name].usd;
    callBack("/api/transactions/buy", "UPDATE_TRANSACTION", body, onSuccess);
  };

  const text = "Proceed";

  return (
    <Container bread={nav}>
      <div className="container">
        <div className="row">
          <div className="col l6 s12 offset-l3 center app-px-1">
            <div className="card-panel app-my-2">
              <table className="striped">
                <tbody>
                  <tr>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="icon icon-btc"
                        style={{ fontSize: "20px" }}
                      ></span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      ${state.prices.bitcoin.usd}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {format("NGN", state.prices.bitcoin.usd * 360)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="icon icon-eth"
                        style={{ fontSize: "20px" }}
                      ></span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      ${state.prices.ethereum.usd}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {format("NGN", state.prices.ethereum.usd * 360)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="icon icon-usdt"
                        style={{ fontSize: "20px" }}
                      ></span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      ${state.prices.tether.usd.toString().slice(0, 4)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {format("NGN", state.prices.tether.usd * 360)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <br />
              <FormComponent
                {...{
                  formArray,
                  initialState,
                  text,
                  fetching,
                  errors,
                  message,
                  onSubmit,
                  onChangeCallBack,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

export default BuyFormPage;
