import { v } from "convex/values";
import { action } from "./_generated/server";
import { MailerSend } from "mailersend";

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mailersend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });

    try {
      const result = await mailersend.email.send({
        from: {
          email: "no-reply@test-86org8eynongew13.mlsender.net",
          name: "Splitt",
        },
        to: [
          {
            email: args.to,
          },
        ],
        subject: args.subject,
        html: args.html,
        text: args.text,
      });

      console.log("Email sent successfully:", result);

      return { success: true };
    } catch (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }
  },
});
