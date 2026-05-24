# Deploy MediCare on Vercel

## 1. Project root

When importing the GitHub repository into Vercel, set the root directory to the folder that contains `package.json`.

For this workspace, that folder is:

```text
MEDICARE-main
```

If you upload the inner project folder itself, leave the Vercel root directory as the repository root.

## 2. Required environment variables

Set these in Vercel Project Settings > Environment Variables:

```text
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=your-long-random-secret
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-admin-password
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
EMAIL_USER=your-email-address
EMAIL_PASS=your-email-app-password
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
MEETING_BASE_URL=https://meet.jit.si
```

Use MongoDB Atlas for `MONGODB_URI`; `mongodb://localhost:27017/medicare` will not work on Vercel.

`BLOB_READ_WRITE_TOKEN` is needed for doctor profile photos and verification documents. Create a Vercel Blob store from the Vercel dashboard and connect it to this project.

## 3. Vercel settings

Use:

```text
Framework Preset: Other
Install Command: npm install
Build Command: empty
Output Directory: empty
```

The app uses Vercel's Express support through `app.js`, which exports the Express app.

## 4. CLI deploy

From the project folder:

```powershell
npm install
npm run dev
npm i -g vercel
vercel login
vercel
```

For production:

```powershell
vercel --prod
```
