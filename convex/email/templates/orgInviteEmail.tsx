import { render } from "@react-email/render";
import { Body, Container, Head, Html, Link, Text } from "@react-email/components";
import { sendEmail } from "../index";
import { SITE_URL } from "../../env";

type OrgInviteEmailOptions = {
  email: string;
  orgName: string;
  token: string;
};

export function OrgInviteEmail({ orgName, token }: OrgInviteEmailOptions) {
  const acceptUrl = `${SITE_URL || "https://contract-generator.example.com"}/invitatie?token=${encodeURIComponent(token)}`;

  return (
    <Html>
      <Head />
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Bună!
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Ai fost invitat în organizația <strong>{orgName}</strong>.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <Link href={acceptUrl}>Acceptă invitația</Link> pentru a te alătura organizației.
          </Text>
          <Text style={{ fontSize: "14px", lineHeight: "24px", color: "#666" }}>
            Link-ul este valid 48 de ore.
          </Text>
          <Text style={{ color: "#8898aa", fontSize: "12px", marginTop: "20px" }}>
            Contract Generator
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function sendOrgInviteEmail(opts: OrgInviteEmailOptions) {
  const html = render(<OrgInviteEmail {...opts} />);
  await sendEmail({
    to: opts.email,
    subject: `Invitație în ${opts.orgName} - Contract Generator`,
    html,
  });
}
