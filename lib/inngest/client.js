import { Inngest } from "inngest";
import { MailerSend } from "mailersend";
// Create a client to send and receive events
export const inngest = new Inngest({ id: "splitt", name:"Splitt" });

export const mailersend = new MailerSend(process.env.MAILERSEND_API_KEY);