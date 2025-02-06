import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';

interface VerifyEmailProps {
  userName: string;
  verificationUrl: string;
}

export const VerifyEmail = ({ userName, verificationUrl }: VerifyEmailProps) => (
  <Html>
    <Head />
    <Preview>Verify your email address</Preview>
    <Tailwind>
      <Body className="bg-[#0a0a0a] text-white my-auto mx-auto font-sans">
        <Container className="border border-solid border-[#1a1a1a] rounded-lg p-8 my-10 mx-auto">
          <Heading className="text-2xl font-bold text-white mb-0 text-center">
            Verify your email
          </Heading>

          <Text className="text-[#8f9ba8] text-base mb-0 mt-6">
            Hey {userName},
          </Text>

          <Text className="text-[#8f9ba8] text-base">
            Thanks for signing up! Please verify your email address to access your account.
          </Text>

          <Section className="text-center mt-8">
            <Button
              className="bg-[#7c3aed] rounded-md text-white px-6 py-3 text-sm font-medium"
              href={verificationUrl}
            >
              Verify Email
            </Button>
          </Section>

          <Text className="text-[#8f9ba8] text-xs mt-6">
            If you didn&aspo;t create an account, you can safely ignore this email.
          </Text>

          <Text className="text-[#8f9ba8] text-xs mt-6">
            Or copy and paste this URL into your browser:
            <br />
            <Link href={verificationUrl} className="text-[#7c3aed]">
              {verificationUrl}
            </Link>
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);
