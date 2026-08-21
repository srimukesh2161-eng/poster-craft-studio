import { SignIn } from "@clerk/clerk-react";

function Login() {
  return (
    <div className="login-page">
      <SignIn />
    </div>
  );
}

export default Login;