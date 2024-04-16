// import twilio from "twilio";
export {};
// export class TwilioVerificationService {
//   static async sendVerificationCode(
//     countryCode: string,
//     phoneNumber: string
//   ): Promise<string> {
//     try {
//       const numberWithCode = `${countryCode}${phoneNumber}`;
//       const client = twilio(
//         settings.twilioCredentials.accountSid,
//         settings.twilioCredentials.authToken
//       );
//       const verification = await client.verify.v2
//         .services(settings.twilioCredentials.serviceVerifyId)
//         .verifications.create({
//           to: numberWithCode,
//           channel: "sms",
//         });
//       return verification.sid;
//     } catch (error) {
//       console.error("Error sending verification code:", error);
//       throw error;
//     }
//   }
//   static async verifyCode(
//     countryCode: string,
//     phoneNumber: string,
//     code: string
//   ): Promise<boolean> {
//     try {
//       const numberWithCode = `${countryCode}${phoneNumber}`;
//       const client = twilio(
//         settings.twilioCredentials.accountSid,
//         settings.twilioCredentials.authToken
//       );
//       const verificationCheck = await client.verify.v2
//         .services(settings.twilioCredentials.serviceVerifyId)
//         .verificationChecks.create({
//           to: numberWithCode,
//           code,
//         });
//       return verificationCheck.status === "approved";
//     } catch (error) {
//       console.error("Error verifying code:", error);
//       throw error;
//     }
//   }
// }
