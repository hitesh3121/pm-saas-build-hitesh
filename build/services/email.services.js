import AWS from "aws-sdk";
import { settings } from "../config/settings.js";
import { generateOTP } from "../utils/otpHelper.js";
import { OtpService } from "./userOtp.services.js";
export class EmailService {
    static async sendEmail(toEmail, subjectMessage, bodyMessage, html) {
        AWS.config.update({
            region: settings.emailCredentials.region,
            accessKeyId: settings.emailCredentials.accessKeyId,
            secretAccessKey: settings.emailCredentials.secretAccessKey,
        });
        const ses = new AWS.SES();
        const params = {
            Destination: {
                ToAddresses: [toEmail],
            },
            Message: {
                Body: {
                    Text: {
                        Data: bodyMessage,
                    },
                    Html: {
                        Data: html ?? "",
                    },
                },
                Subject: {
                    Data: subjectMessage,
                },
            },
            Source: settings.noReplyEmailId,
        };
        try {
            const result = await ses.sendEmail(params).promise();
            return result;
        }
        catch (error) {
            console.error(error);
            throw error;
        }
    }
    static async sendOTPTemplate(email, userId, tenantId, expiresInMinutes) {
        const otpValue = generateOTP();
        const subjectMessage = `ProjectChef : One Time Password`;
        const bodyMessage = `
      Hello,

      Kindly find here your One Time Password: ${otpValue}.
      Please do not share this number with anyone.
      This number is valid for ${expiresInMinutes} minutes.

      Best Regards,
      ProjectChef Support Team
  `;
        const html = `
            <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
            <html dir="ltr" lang="en">

              <head>
                <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
              </head>

              <body style="background-color:#ffffff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:350px;background-color:#ffffff;border:1px solid #eee;border-radius:5px;box-shadow:0 5px 10px rgba(20,50,70,.2);margin-top:20px;margin:0 auto;position:relative;background-image:url(${settings.appURL}assets/CircleBackground-eb6a2aba.png), url(${settings.appURL}assets/LineBackground-b0fb4b25.png);background-position:right top, left bottom;background-repeat:no-repeat;background-size:200px,200px">
                  <tbody>
                    <tr style="width:100%">
                      <td>
                        <h1 style="text-align:center;color:#7a310d;margin-bottom:40px;margin-top:40px">ProjectChef</h1>
                        <h1 style="color:#808080;font-size:15px;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;line-height:23px;padding:0 40px;margin:0;text-align:left">Kindly find here your One Time Passowrd :</h1>
                        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="background:rgba(0,0,0,.05);border-radius:4px;margin:16px auto 14px;vertical-align:middle;width:280px">
                          <tbody>
                            <tr>
                              <td>
                                <p style="font-size:32px;line-height:40px;margin:0 auto;color:#7a310d;display:inline-block;font-family:HelveticaNeue-Bold;font-weight:700;letter-spacing:6px;padding-bottom:8px;padding-top:8px;width:100%;text-align:center">${otpValue}</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left"> <!-- -->Please do not share this number with anyone. This number is valid for 5 minutes</p>
                        <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:center;margin-top:50px">Need help? </p>
                        <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:center;margin-bottom:50px">Ask at<!-- --> <a href="mailto:support@projectchef" style="color:#444;text-decoration:underline" target="_blank">support@projectchef</a></p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </body>
            </html>
            `;
        try {
            await OtpService.saveOTP(otpValue, userId, tenantId, expiresInMinutes * 60);
            await EmailService.sendEmail(email, subjectMessage, bodyMessage, html);
        }
        catch (error) {
            console.error("Failed to send OTP", error);
        }
    }
    static async sendResetPasswordTemplate(email, token) {
        const subjectMessage = `Reset your ProjectChef password`;
        const bodyMessage = `
      Hello,

      We have received your request for password reset for ProjectChef on this account : ${email}. 
      If you don't want to reset your password, you can ignore this email.
      If you have received this email in error or you suspect fraud, please let us know at support@projectchef.io
      URL: ${settings.appURL}/reset-password/?token=${token}

      Best Regards,
      ProjectChef Support Team

  `;
        const html = `
          <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html dir="ltr" lang="en">

            <head>
              <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
            </head>

            <body style="background-color:#ffffff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
              <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:350px;background-color:#ffffff;border:1px solid #eee;border-radius:5px;box-shadow:0 5px 10px rgba(20,50,70,.2);margin-top:20px;margin:0 auto;position:relative;background-image:url(${settings.appURL}assets/CircleBackground-eb6a2aba.png), url(${settings.appURL}assets/LineBackground-b0fb4b25.png);background-position:right top, left bottom;background-repeat:no-repeat;background-size:200px,200px">
                <tbody>
                  <tr style="width:100%">
                    <td>
                      <h1 style="text-align:center;color:#7a310d;margin-bottom:40px">ProjectChef</h1>
                      <h1 style="color:#808080;font-size:15px;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;line-height:23px;padding:0 40px;margin:0;text-align:left">Reset password </h1>
                      <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- -->We have received your request for password reset for ProjectChef on this account: ${email} .</p>
                      <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- -->If you don&#x27;t want to reset your password, you can ignore this email.</p>
                      <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:20px">If you have received this email in error or you suspect fraud, please let us know at support@projectchef.io.</p>
                      <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:20px"><a href="${settings.appURL}reset-password/?token=${token}" style="color:#444;text-decoration:underline" target="_blank">Click here to reset password</a></p>
                      <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:center;margin-top:50px">Need help? </p>
                      <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:center;margin-bottom:50px">Ask at<!-- --> <a href="mailto:support@projectchef" style="color:#444;text-decoration:underline" target="_blank">support@projectchef</a></p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </body>

          </html>
    `;
        try {
            await EmailService.sendEmail(email, subjectMessage, bodyMessage, html);
        }
        catch (error) {
            console.error("Failed to send Email", error);
        }
    }
    static async sendInvitationInConsoleTemplate(email, randomPassword) {
        const subjectMessage = `Invited`;
        const bodyMessage = `
      You are invited in console
      
      URL: ${settings.adminURL}login
      LOGIN: ${email}
      PASSWORD: ${randomPassword}
      `;
        const html = `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html dir="ltr" lang="en">

        <head>
          <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
        </head>

        <body style="background-color:#ffffff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:350px;background-color:#ffffff;border:1px solid #eee;border-radius:5px;box-shadow:0 5px 10px rgba(20,50,70,.2);margin-top:20px;margin:0 auto;position:relative;background-image:url(${settings.appURL}assets/CircleBackground-eb6a2aba.png), url(${settings.appURL}assets/LineBackground-b0fb4b25.png);background-position:right top, left bottom;background-repeat:no-repeat;background-size:200px,200px">
            <tbody>
              <tr style="width:100%">
                <td>
                  <h1 style="text-align:center;color:#7a310d;margin-bottom:40px">ProjectChef</h1>
                  <h1 style="color:#808080;font-size:15px;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;line-height:23px;padding:0 40px;margin:0;text-align:left">Invitation</h1>
                                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- -->${email} You are invited in console on ProjectChef.</p>
                                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- -->Please use the information bellow to login:</p>
                                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:20px"> <!-- -->Url:<!-- --> <a href="${settings.adminURL}login" style="color:#444;text-decoration:underline" target="_blank">${settings.adminURL}login</a></p>
                                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left">Email:${email} Password: ${randomPassword}</p>
                                <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:center;margin-top:50px">Need help? </p>
                  <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:center;margin-bottom:50px">Ask at<!-- --> <a href="mailto:support@projectchef" style="color:#444;text-decoration:underline" target="_blank">support@projectchef</a></p>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
        try {
            await EmailService.sendEmail(email, subjectMessage, bodyMessage, html);
        }
        catch (error) {
            console.error("Failed to send Email", error);
        }
    }
    static async sendEmailForAddUserToOrganisationTemplate(organisationName, adminName, email, randomPassword) {
        const subjectMessage = `You've been Invited to ${organisationName} organization `;
        const bodyMessage = `
      Hello,

      ${adminName} invited you to his/her Organization 
      ${organisationName} on ProjectChef.
      Please use the information bellow to login:
      
      URL: ${settings.appURL}/login
      LOGIN: ${email}
      PASSWORD: ${randomPassword}

      Best Regards,
      ProjectChef Support Team

      `;
        const html = `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html dir="ltr" lang="en">

          <head>
            <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
          </head>

          <body style="background-color:#ffffff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:350px;background-color:#ffffff;border:1px solid #eee;border-radius:5px;box-shadow:0 5px 10px rgba(20,50,70,.2);margin-top:20px;margin:0 auto;position:relative;background-image:url(${settings.appURL}assets/CircleBackground-eb6a2aba.png), url(${settings.appURL}assets/LineBackground-b0fb4b25.png);background-position:right top, left bottom;background-repeat:no-repeat;background-size:200px,200px">
              <tbody>
                <tr style="width:100%">
                  <td>
                    <h1 style="text-align:center;color:#7a310d;margin-bottom:40px">ProjectChef</h1>
                    <h1 style="color:#808080;font-size:15px;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;line-height:23px;padding:0 40px;margin:0;text-align:left">Invitation</h1>
                    <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- -->${adminName} invited you to his/her Organization ${organisationName} on ProjectChef.</p>
                    <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- -->Please use the information bellow to login:</p>
                    <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:20px"> <!-- -->Url:<!-- --> <a href="${settings.appURL}/login" style="color:#444;text-decoration:underline" target="_blank">${settings.appURL}/login</a></p>
                    <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left">Email:${email} Password: ${randomPassword}</p>
                    <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:center;margin-top:50px">Need help? </p>
                    <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:center;margin-bottom:50px">Ask at<!-- --> <a href="mailto:support@projectchef" style="color:#444;text-decoration:underline" target="_blank">support@projectchef</a></p>
                  </td>
                </tr>
              </tbody>
            </table>
          </body>

        </html>
    `;
        try {
            await EmailService.sendEmail(email, subjectMessage, bodyMessage, html);
        }
        catch (error) {
            console.error("Failed to send Email", error);
        }
    }
    static async sendDueTaskTemplate(email, nameOfUser, taskNamesString) {
        const subjectMessage = `ProjectChef: Task Due Today`;
        let message = `
      Hello ${nameOfUser}
      
      Please note that these tasks are due today:
      Task ${taskNamesString} is due today.
      
      Best Regards,
      ProjectChef Support Team
      `;
        const html = `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html dir="ltr" lang="en">

          <head>
            <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
          </head>

          <body style="background-color:#ffffff;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
            <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:350px;background-color:#ffffff;border:1px solid #eee;border-radius:5px;box-shadow:0 5px 10px rgba(20,50,70,.2);margin-top:20px;margin:0 auto;position:relative;background-image:url(${settings.appURL}assets/CircleBackground-eb6a2aba.png), url(${settings.appURL}assets/LineBackground-b0fb4b25.png);background-position:right top, left bottom;background-repeat:no-repeat;background-size:200px,200px">
              <tbody>
                <tr style="width:100%">
                  <td>
                    <h1 style="text-align:center;color:#7a310d;margin-bottom:40px">ProjectChef</h1>
                    <h1 style="color:#808080;font-size:15px;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;line-height:23px;padding:0 40px;margin:0;text-align:left">Task due</h1>
                    <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- -->Hello ${nameOfUser}</p>
                    <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- -->Please note that these tasks are due today:</p>
                    <p style="font-size:15px;line-height:23px;margin:0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- -->Task ${taskNamesString} is due today.</p>
                    <p style="font-size:15px;line-height:23px;margin:0 0 20px 0;color:#808080;font-family:HelveticaNeue,Helvetica,Arial,sans-serif;letter-spacing:0;padding:0 40px;text-align:left;margin-top:10px"> <!-- --><a href="https://app.projectchef.io/mytasks?todayDueDays=true" style="color:#444;text-decoration:underline" target="_blank">See tasks</a></p>
                  </td>
                </tr>
              </tbody>
            </table>
          </body>

        </html>
      `;
        try {
            await EmailService.sendEmail(email, subjectMessage, message, html);
        }
        catch (error) {
            console.error("Error while sending duetask email", error);
        }
    }
}
