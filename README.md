# BrightCare Health Plans

A simple health insurance website. It includes plan options, support details, an about section, and a contact form that sends messages by email.

## Files

- `index.html` - main landing page
- `styles.css` - responsive styling
- `script.js` - contact form submission handling
- `server.js` - small backend that serves the site and sends contact emails

## Contact Email Setup

Copy `.env.example` to `.env` and fill in your SMTP settings:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
CONTACT_TO=dot.edwardtuttle@gmail.com
CONTACT_FROM=your-email@gmail.com
```

For Gmail, use an app password instead of your normal account password.

## Start The Website

Start the backend:

```bash
node server.js
```

Then open `http://localhost:5500` in your browser.

Do not open `index.html` directly from your files for the contact form. The form needs the backend running at `http://localhost:5500`.

## Static-Only Preview

The PowerShell and `npm run static` servers can still preview the pages, but the contact form needs `node server.js` to send email.

## Expose The Site With Ngrok

1. Sign up for an ngrok account and get your authtoken.
2. Replace `YOUR_NGROK_AUTHTOKEN` in `ngrok.yml`, or run `.\start-ngrok.ps1 -AuthToken <your-token>`.
3. Start the local backend:

```bash
node server.js
```

4. Run ngrok:

```powershell
.\start-ngrok.ps1 -AuthToken <your-token>
```

5. The tunnel is configured to use the domain in your ngrok setup.

## Customize

Update the text, colors, and branding to match your insurance business.
