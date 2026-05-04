# BrightWave Digital Marketing

A simple static website for a digital marketing agency. This project includes a homepage, service overview, work highlights, about section, and a contact form placeholder.

## Files

- `index.html` — main landing page
- `styles.css` — responsive styling
- `script.js` — basic form submission handling

## Usage

### Option 1: Use Python

Run the built-in Python server script:

```bash
python serve.py
```

Then open `http://localhost:5500` in your browser. The site is branded for `brightwaveagency.com`.

### Option 2: Use PowerShell server

Run the built-in server script in PowerShell:

```powershell
.\serve.ps1
```

### Option 3: Use Node.js (if installed)

```bash
npm install
npm start
```

### Option 4: Expose the site with ngrok

1. Sign up for an ngrok account and get your authtoken.
2. Replace `YOUR_NGROK_AUTHTOKEN` in `ngrok.yml`, or run `.
start-ngrok.ps1 -AuthToken <your-token>`.
3. Start the local server:

```bash
python3 serve.py
```

4. Run ngrok:

```powershell
.\start-ngrok.ps1 -AuthToken <your-token>
```

5. Copy the public URL shown in ngrok output to share the live site.

## Customize

Update the text, colors, and branding to match your agency.
