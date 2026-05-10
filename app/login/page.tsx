import LoginForm from './login-form';

export default function LoginPage() {
  const allowRegistration = process.env.ALLOW_REGISTRATION === 'true';

  return <LoginForm allowRegistration={allowRegistration} />;
}
