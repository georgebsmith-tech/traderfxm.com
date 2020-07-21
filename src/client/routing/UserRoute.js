import React from "react";
import { Route, Redirect } from "react-router-dom";
import { AppContext } from "providers/AppProvider";

function UserRoute(props) {
  const { state } = React.useContext(AppContext);
  const { user } = state;

  if (!user) {
    return <Redirect to="/signin.html" />;
  }

  if (user.verified < 1) {
    let verPath = "/user/auth/verifyemail.html";

    if (props.path == verPath) {
      return <Route {...props} />;
    }

    return <Redirect to={verPath} />;
  }

  return <Route {...props} />;
}

export default UserRoute;
