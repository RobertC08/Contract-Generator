import { render } from "@react-email/render";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Text,
} from "@react-email/components";
import { sendEmail } from "../index";
import { SITE_URL } from "../../env";

type SubscriptionEmailOptions = {
  email: string;
  subscriptionId: string;
};

export function SubscriptionSuccessEmail({ email }: SubscriptionEmailOptions) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Bună {email}!
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Abonamentul tău Pro a fost activat cu succes.
            <br />
            Poți accesa toate funcționalitățile noi.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Echipa <Link href={SITE_URL || "https://contract-generator.example.com"}>Contract Generator</Link>.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>
            Contract Generator
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function SubscriptionErrorEmail({ email }: SubscriptionEmailOptions) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Bună {email}.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Nu am putut procesa abonamentul tău Pro.
            <br />
            Nu te îngrijora, nu vei fi taxat.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Echipa <Link href={SITE_URL || "https://contract-generator.example.com"}>Contract Generator</Link>.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>
            Contract Generator
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function sendSubscriptionSuccessEmail(
  opts: SubscriptionEmailOptions
) {
  const html = render(<SubscriptionSuccessEmail {...opts} />);
  await sendEmail({
    to: opts.email,
    subject: "Abonament Pro activat - Contract Generator",
    html,
  });
}

export async function sendSubscriptionErrorEmail(opts: SubscriptionEmailOptions) {
  const html = render(<SubscriptionErrorEmail {...opts} />);
  await sendEmail({
    to: opts.email,
    subject: "Problemă abonament - Contract Generator",
    html,
  });
}
