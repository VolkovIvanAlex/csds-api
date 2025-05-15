// import * as nodemailer from 'nodemailer';
// import {
//   RegistrationSuccessData,
//   registrationSuccessTemplate,
// } from './mail-templates/registration.template';
// import {
//   NewResearchProjectData,
//   newResearchProjectTemplate,
// } from './mail-templates/research-creation.template';
// import {
//   CoAuthorAddedData,
//   coAuthorAddedTemplate,
// } from './mail-templates/reasearcher-addition.tempalte';
// import {
//   resetPasswordTemplate,
//   ResetPasswordData,
// } from './mail-templates/reset-pass.template';
// import { google } from 'googleapis';
// import { Injectable } from '@nestjs/common';

// const OAuth2 = google.auth.OAuth2;

// export enum EmailTemplateType {
//   RegistrationSuccess = 'RegistrationSuccess',
//   NewResearchProject = 'NewResearchProject',
//   CoAuthorAdded = 'CoAuthorAdded',
//   ResetPassword = 'ResetPassword',
// }

// const isTestEnv = process.env.NODE_ENV === 'test'; // Check if in test environment

// @Injectable()
// export class MailService {
//   private transporter = async (): Promise<
//     nodemailer.Transporter | undefined
//   > => {
//     try {
//       const oauth2Client = new OAuth2(
//         process.env.CLIENT_ID,
//         process.env.CLIENT_SECRET,
//         'https://developers.google.com/oauthplayground',
//       );

//       oauth2Client.setCredentials({
//         refresh_token: process.env.REFRESH_TOKEN,
//       });

//       const accessToken = await new Promise<string>((resolve, reject) => {
//         oauth2Client.getAccessToken((err, token) => {
//           if (err) {
//             console.error('Error generating access token:', err);
//             return reject(err);
//           }
//           resolve(token as string);
//         });
//       });

//       const transporter = nodemailer.createTransport({
//         // service: 'gmail',
//         host: 'smtp.gmail.com',
//         port: 587,
//         secure: false,
//         auth: {
//           type: 'OAuth2',
//           user: process.env.USER_EMAIL as string,
//           accessToken,
//           clientId: process.env.CLIENT_ID as string,
//           clientSecret: process.env.CLIENT_SECRET as string,
//           refreshToken: process.env.REFRESH_TOKEN as string,
//         },
//         connectionTimeout: 10000,
//         //debug: !isTestEnv, // Enable debug only outside tests
//         //logger: !isTestEnv, // Enable logger only outside tests
//       });

//       return transporter;
//     } catch (err) {
//       console.error('Error creating transporter:', err);
//     }
//   };

//   async sendEmail(
//     email: string,
//     templateType: EmailTemplateType,
//     data:
//       | RegistrationSuccessData
//       | NewResearchProjectData
//       | CoAuthorAddedData
//       | ResetPasswordData,
//   ) {
//     const { subject, html } = this.getTemplate(templateType, data);
//     const mailOptions = {
//       from: process.env.USER_EMAIL || 'donotreply@localhost',
//       to: email,
//       subject: subject,
//       html: html,
//     };

//     const trans = await this.transporter();

//     trans?.sendMail(mailOptions, (error, info) => {
//       if (isTestEnv) return; // Exit early in test env, no logging
//       if (error) {
//         console.error('Error sending email:', error);
//       } else {
//         // console.log('Email sent successfully:', info.response);
//       }
//     });
//   }

//   private getTemplate(
//     templateType: EmailTemplateType,
//     data:
//       | RegistrationSuccessData
//       | NewResearchProjectData
//       | CoAuthorAddedData
//       | ResetPasswordData,
//   ): { subject: string; html: string } {
//     switch (templateType) {
//       case EmailTemplateType.RegistrationSuccess:
//         return {
//           subject: 'Successful Registration on Research Integrity Chain!',
//           html: registrationSuccessTemplate(data as RegistrationSuccessData),
//         };
//       case EmailTemplateType.NewResearchProject:
//         return {
//           subject: 'Your New Research Project Has Been Created!',
//           html: newResearchProjectTemplate(data as NewResearchProjectData),
//         };
//       case EmailTemplateType.CoAuthorAdded:
//         return {
//           subject: 'You’ve Been Added as a Co-Author!',
//           html: coAuthorAddedTemplate(data as CoAuthorAddedData),
//         };
//       case EmailTemplateType.ResetPassword:
//         return {
//           subject: 'Reset your password!',
//           html: resetPasswordTemplate(data as ResetPasswordData),
//         };
//       default:
//         throw new Error('Invalid email template type');
//     }
//   }
// }
