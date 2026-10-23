// Vilka sidor sokmotorer far se (docs/design.md, "Ikoner, delning och
// metadata"). Lasas av src/app/robots.ts och src/app/sitemap.ts.
//
// Listan ar en vitlista, inte en svartlista: robots.txt forbjuder allt och
// tillater bara dessa adresser exakt. En ny inloggad vy blir alltsa aldrig
// sokbar av misstag – den maste laggas till har, och tester/publika-sidor.test.ts
// kraver att varje sida har gar att na utan inloggning.
//
// Utanfor listan, fast de nas utan inloggning:
//   /inbjudan/<id>   bar bostadens adress och tva e-postadresser i brodtexten
//   /auth/callback   loser in en inloggningslank, ingen sida
//   /losenord/glomt  ett verktyg for den som redan har konto, inget att soka fram
//   /losenord/nytt   nas bara via aterstallningsmejlets lank

export const SOKBARA_SIDOR = ["/", "/registrera", "/login", "/integritetspolicy"] as const;
