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
  <html lang="en"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Static Template</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&amp;display=swap" rel="stylesheet">
  </head>
  <body style="
      margin: 0;
      font-family: 'Poppins', sans-serif;
      background: #FFFFFF;
      font-size: 14px;
    ">
    <div style="
        max-width: 680px;
        margin: 0 auto;
        padding: 45px 30px 60px;
        background: #F4F7FF;
        background-repeat: no-repeat;
        background-size: 800px 452px;
        background-position: top center;
        font-size: 14px;
        color: #434343;
        background: linear-gradient(135deg, #FFB819, #943B0C);
      ">
      <header>
        <table style="width: 100%;">
          <tbody>
            <tr style="height: 0; color:ffffff; font-size: 24px; line-height: 30px">
              <td>
                Projectchef
              </td>
            </tr>
          </tbody>
        </table>
      </header>
      <main>
        <div style="
            margin: 0;
            margin-top: 70px;
            padding: 92px 30px 115px;
            background: #FFFFFF;
            border-radius: 30px;
            text-align: center;
          ">
          <div style="width: 100%; max-width: 489px; margin: 0 auto;">
            <h1 style="
                margin: 0;
                font-size: 24px;
                font-weight: 500;
                color: #1F1F1F;
              ">
              Your OTP
            </h1>
            <p style="
                margin: 0;
                margin-top: 17px;
                font-size: 16px;
                font-weight: 500;
              ">
              Hey ${email},
            </p>
            <p style="
                margin: 0;
                margin-top: 17px;
                font-weight: 500;
                letter-spacing: 0.56px;
              ">
               Please do not share this number with anyone.
      This number is valid for
              <span style="font-weight: 600; color: #1F1F1F;">5 minutes</span>. <br /><br />
               Kindly find here your One Time Passowrd :
            </p>
            <p style="
                margin: 0;
                margin-top: 60px;
                font-size: 40px;
                font-weight: 600;
                letter-spacing: 25px;
                color: #BA3D4F;
              ">
              ${otpValue}
            </p>
          </div>
        </div>
      </main>
      <footer style="
          width: 100%;
          max-width: 490px;
          margin: 20px auto 0;
          text-align: center;
          border-top: 1px solid #E6EBF1;
        ">
        <p style="margin: 0; margin-top: 16px; color: #FFFFFF;">
          Copyright © 2024. All rights reserved.
        </p>
      </footer>
    </div>
</body></html> 
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
      <html lang="en"><head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>Static Template</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&amp;display=swap" rel="stylesheet">
      </head>
      <body style="
          margin: 0;
          font-family: 'Poppins', sans-serif;
          background: #FFFFFF;
          font-size: 14px;
        ">
        <div style="
            max-width: 680px;
            margin: 0 auto;
            padding: 45px 30px 60px;
            background: #F4F7FF;
            background-repeat: no-repeat;
            background-size: 800px 452px;
            background-position: top center;
            font-size: 14px;
            color: #434343;
            background: linear-gradient(135deg, #FFB819, #943B0C);
          ">
          <header>
            <table style="width: 100%;">
              <tbody>
                <tr style="height: 0; color:ffffff; font-size: 24px; line-height: 30px">
                  <td>
                    Projectchef
                  </td>
                </tr>
              </tbody>
            </table>
          </header>
          <main>
            <div style="
                margin: 0;
                margin-top: 70px;
                padding: 92px 30px 115px;
                background: #FFFFFF;
                border-radius: 30px;
                text-align: center;
              ">
              <div style="width: 100%; max-width: 489px; margin: 0 auto;">
                <h1 style="
                    margin: 0;
                    font-size: 24px;
                    font-weight: 500;
                    color: #1F1F1F;
                  ">
                  Reset password
                </h1>
                <p style="
                    margin: 0;
                    margin-top: 17px;
                    font-size: 16px;
                    font-weight: 500;
                  ">
                  Hey Tomy,
                </p>
                <p style="
                    margin: 0;
                    margin-top: 17px;
                    font-weight: 500;
                    letter-spacing: 0.56px;
                  ">
                  We have received your request for password reset for ProjectChef on this account :              <span style="font-weight: 600; color: #1F1F1F;">${email} . </span> <br /><br />
      If you don't want to reset your password, you can ignore this email. <br/> <br/>
      If you have received this email in error or you suspect fraud, please let us know at<span style="font-weight: 600; color: #1F1F1F;">support@projectchef.io</span>
                  <br/><br/>
                </p>
              URL: ${settings.appURL}/reset-password/?token=${token}
              </div>
            </div>
          </main>
          <footer style="
              width: 100%;
              max-width: 490px;
              margin: 20px auto 0;
              text-align: center;
              border-top: 1px solid #E6EBF1;
            ">
            <p style="margin: 0; margin-top: 16px; color: #FFFFFF;">
              Copyright © 2024. All rights reserved.
            </p>
          </footer>
        </div>
    </body></html>`;
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
          <html lang="en"><head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="ie=edge">
          <title>Static Template</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&amp;display=swap" rel="stylesheet">
        </head>
        <body style="
            margin: 0;
            font-family: 'Poppins', sans-serif;
            background: #FFFFFF;
            font-size: 14px;
          ">
          <div style="
              max-width: 680px;
              margin: 0 auto;
              padding: 45px 30px 60px;
              background: #F4F7FF;
              background-repeat: no-repeat;
              background-size: 800px 452px;
              background-position: top center;
              font-size: 14px;
              color: #434343;
              background: linear-gradient(135deg, #FFB819, #943B0C);
            ">
            <header>
              <table style="width: 100%;">
                <tbody>
                  <tr style="height: 0; color:ffffff; font-size: 24px; line-height: 30px">
                    <td>
                      Projectchef
                    </td>
                  </tr>
                </tbody>
              </table>
            </header>
            <main>
              <div style="
                  margin: 0;
                  margin-top: 70px;
                  padding: 92px 30px 115px;
                  background: #FFFFFF;
                  border-radius: 30px;
                  text-align: center;
                ">
                <div style="width: 100%; max-width: 489px; margin: 0 auto;">
                  <h1 style="
                      margin: 0;
                      font-size: 24px;
                      font-weight: 500;
                      color: #1F1F1F;
                    ">
                    Hello
                  </h1>
                  <p style="
                      margin: 0;
                      margin-top: 17px;
                      font-weight: 500;
                      letter-spacing: 0.56px;
                    ">
                    ${email} You are invited in console on ProjectChef
            Please use the information bellow to
                    <span style="font-weight: 600; color: #1F1F1F;">login</span>:
                  </p>
                  <br/>
                  <p style="
                      margin: 0;
                      margin-top: 17px;
                      font-weight: 500;
                      letter-spacing: 0.56px;
                      font-size: 12px;
                      text-align:left
                    ">
                    ${settings.adminURL}login <br/>
                      <div style="text-align:left; font-size: 10px;  ">
                  LOGIN: <span style="font-weight: 600; color: #1F1F1F;"> ${email}</span> <br/>
                  PASSWORD: <span style="font-weight: 600; color: #1F1F1F;">${randomPassword}</span>
                      </div>
                  </p>
                </div>
              </div>
            </main>
            <footer style="
                width: 100%;
                max-width: 490px;
                margin: 20px auto 0;
                text-align: center;
                border-top: 1px solid #E6EBF1;
              ">
              <p style="margin: 0; margin-top: 16px; color: #FFFFFF;">
                Copyright © 2024. All rights reserved.
              </p>
            </footer>
          </div>
      </body></html>
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
    <html lang="en"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Static Template</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&amp;display=swap" rel="stylesheet">
  </head>
  <body style="
      margin: 0;
      font-family: 'Poppins', sans-serif;
      background: #FFFFFF;
      font-size: 14px;
    ">
    <div style="
        max-width: 680px;
        margin: 0 auto;
        padding: 45px 30px 60px;
        background: #F4F7FF;
        background-repeat: no-repeat;
        background-size: 800px 452px;
        background-position: top center;
        font-size: 14px;
        color: #434343;
        background: linear-gradient(135deg, #FFB819, #943B0C);
      ">
      <header>
        <table style="width: 100%;">
          <tbody>
            <tr style="height: 0; color:ffffff; font-size: 24px; line-height: 30px">
              <td>
                Projectchef
              </td>
            </tr>
          </tbody>
        </table>
      </header>
      <main>
        <div style="
            margin: 0;
            margin-top: 70px;
            padding: 92px 30px 115px;
            background: #FFFFFF;
            border-radius: 30px;
            text-align: center;
          ">
          <div style="width: 100%; max-width: 489px; margin: 0 auto;">
            <h1 style="
                margin: 0;
                font-size: 24px;
                font-weight: 500;
                color: #1F1F1F;
              ">
              Hello
            </h1>
            <p style="
                margin: 0;
                margin-top: 17px;
                font-weight: 500;
                letter-spacing: 0.56px;
              ">
              ${adminName} invited you to his/her Organization
              ${organisationName} organisation on ProjectChef.
      Please use the information bellow to
              <span style="font-weight: 600; color: #1F1F1F;">login</span>:
            </p>
            <br/>
             <p style="
                margin: 0;
                margin-top: 17px;
                font-weight: 500;
                letter-spacing: 0.56px;
                font-size: 12px;
                text-align:left
              ">
              ${settings.appURL}/login <br/>
                <div style="text-align:left; font-size: 10px;  ">
            LOGIN: <span style="font-weight: 600; color: #1F1F1F;"> ${email}</span> <br/>
            PASSWORD: <span style="font-weight: 600; color: #1F1F1F;">${randomPassword}</span>
                </div>
            </p>
          </div>
        </div>
      </main>
      <footer style="
          width: 100%;
          max-width: 490px;
          margin: 20px auto 0;
          text-align: center;
          border-top: 1px solid #E6EBF1;
        ">
        <p style="margin: 0; margin-top: 16px; color: #FFFFFF;">
          Copyright © 2024. All rights reserved.
        </p>
      </footer>
    </div>
</body></html>
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
      Hello, ${nameOfUser}
      
      Please note that these tasks are due today:
      Task ${taskNamesString} is due today.
      
      Best Regards,
      ProjectChef Support Team
      `;
        const html = `
            <html lang="en"><head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="ie=edge">
          <title>Static Template</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&amp;display=swap" rel="stylesheet">
        </head>
        <body style="
            margin: 0;
            font-family: 'Poppins', sans-serif;
            background: #FFFFFF;
            font-size: 14px;
          ">
          <div style="
              max-width: 680px;
              margin: 0 auto;
              padding: 45px 30px 60px;
              background: #F4F7FF;
              background-repeat: no-repeat;
              background-size: 800px 452px;
              background-position: top center;
              font-size: 14px;
              color: #434343;
              background: linear-gradient(135deg, #FFB819, #943B0C);
            ">
            <header>
              <table style="width: 100%;">
                <tbody>
                  <tr style="height: 0; color:ffffff; font-size: 24px; line-height: 30px">
                    <td>
                      Projectchef
                    </td>
                    <td style="text-align: right;">
                      <span style="font-size: 16px; line-height: 30px; color: #FFFFFF;">12 Nov, 2021</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </header>
            <main>
              <div style="
                  margin: 0;
                  margin-top: 70px;
                  padding: 92px 30px 115px;
                  background: #FFFFFF;
                  border-radius: 30px;
                  text-align: center;
                ">
                <div style="width: 100%; max-width: 489px; margin: 0 auto;">
                  <h1 style="
                      margin: 0;
                      font-size: 24px;
                      font-weight: 500;
                      color: #1F1F1F;
                    ">
                    Hello, ${nameOfUser}
                  </h1>
                  <p style="
                      margin: 0;
                      margin-top: 17px;
                      font-weight: 500;
                      letter-spacing: 0.56px;
                    ">
                    Please note that these tasks are due today:<br/>
                    Task ${taskNamesString} is due today.
                    <br/><br/>
                  </p>
                </div>
              </div>
            </main>
            <footer style="
                width: 100%;
                max-width: 490px;
                margin: 20px auto 0;
                text-align: center;
                border-top: 1px solid #E6EBF1;
              ">
              <p style="margin: 0; margin-top: 16px; color: #FFFFFF;">
                Copyright © 2024. All rights reserved.
              </p>
            </footer>
          </div>
      </body></html>`;
        try {
            await EmailService.sendEmail(email, subjectMessage, message, html);
        }
        catch (error) {
            console.error("Error while sending duetask email", error);
        }
    }
}
