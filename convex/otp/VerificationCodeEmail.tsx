import {
  Container,
  Head,
  Heading,
  Html,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export function VerificationCodeEmail({
  code,
  expires,
}: {
  code: string;
  expires: Date;
}) {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Container className="container px-20 font-sans">
          <Heading className="text-xl font-bold mb-4">
            Autentificare - Contract Generator
          </Heading>
          <Text className="text-sm">
            Introdu codul de mai jos pe pagina de autentificare.
          </Text>
          <Section className="text-center">
            <Text className="font-semibold">Cod de verificare</Text>
            <Text className="font-bold text-4xl">{code}</Text>
            <Text>
              (Codul este valid{" "}
              {Math.floor((+expires - Date.now()) / (60 * 60 * 1000))} ore)
            </Text>
          </Section>
        </Container>
      </Tailwind>
    </Html>
  );
}
