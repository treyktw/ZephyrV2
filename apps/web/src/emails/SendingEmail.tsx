import React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface EmailTemplateProps {
  userEmail: string;
  verificationLink: string;
}

export function EmailTemplate({ userEmail, verificationLink }: EmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>Sign in to your ZephyrV2 account</Preview>
      <Body style={{
        backgroundColor: '#f6f9fc',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
      }}>
        <Container style={{
          backgroundColor: '#ffffff',
          border: '1px solid #f0f0f0',
          borderRadius: '5px',
          boxShadow: '0 5px 10px rgba(20,50,70,.2)',
          marginTop: '20px',
          maxWidth: '600px',
          padding: '48px',
        }}>
          <Heading style={{
            color: '#000',
            fontSize: '24px',
            fontWeight: '600',
            lineHeight: '1.3',
            margin: '0 0 24px',
          }}>
            Sign in to ZephyrV2
          </Heading>
          <Text style={{
            color: '#525f7f',
            fontSize: '16px',
            lineHeight: '24px',
            margin: '0 0 24px',
          }}>
            Click the button below to sign in as {userEmail}.
          </Text>
          <Section style={{
            textAlign: 'center',
            margin: '32px 0',
          }}>
            <Link
              href={verificationLink}
              style={{
                backgroundColor: '#000',
                borderRadius: '5px',
                color: '#fff',
                display: 'inline-block',
                fontSize: '14px',
                fontWeight: '600',
                lineHeight: '50px',
                textDecoration: 'none',
                textAlign: 'center',
                width: '200px',
              }}
            >
              Sign in
            </Link>
          </Section>
          <Text style={{
            color: '#525f7f',
            fontSize: '14px',
            lineHeight: '24px',
          }}>
            If you did not request this email, you can safely ignore it.
          </Text>
          <Text style={{
            color: '#525f7f',
            fontSize: '14px',
            lineHeight: '24px',
          }}>
            You can also copy and paste this URL into your browser:
          </Text>
          <Text style={{
            color: '#525f7f',
            fontSize: '14px',
            lineHeight: '24px',
            margin: '0 0 24px',
          }}>
            {verificationLink}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
