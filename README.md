# Apna AI Video Maker

Apna AI Video Maker ek responsive website hai jahan user apna prompt likh kar AI video generate kar sakta hai. Frontend GitHub Pages par chal sakta hai. Real video generation ke liye secure backend aur paid/credited AI provider zaroori hai.

## Is project mein kya hai?

- Prompt editor aur ready-made prompt examples
- Landscape, vertical aur square video format choices
- Cinematic, realistic, animation, anime, commercial aur documentary styles
- Backend API se real video-generation request
- Job status polling, video preview aur download link
- Browser ke local storage mein saved projects
- Cloudflare Workers ke liye backend starter (`worker.js`)
- Mobile-friendly dark UI

## 1. GitHub Pages par website publish karein

1. Repository: https://github.com/prime-mail/apna-video-maker
2. Repository ke **Settings** tab par jayein.
3. Left menu mein **Pages** kholein.
4. **Build and deployment** ke neeche **GitHub Actions** choose karein.
5. Is repository mein `.github/workflows/pages.yml` workflow website publish karne ki koshish karega.
6. **Actions** tab par workflow ka status check karein.
7. Publish hone ke baad website is address par honi chahiye:
   https://prime-mail.github.io/apna-video-maker/

Kabhi kabhi GitHub Pages ko publish hone mein chand minute lagte hain. Agar pehli deployment permission error de to Settings > Actions > General mein workflow permissions check karein.

## 2. Asal AI video generation ke liye backend

Sirf GitHub Pages HTML/JavaScript se secret API key ko mehfooz nahi rakha ja sakta. Isi liye `worker.js` ko Cloudflare Worker ke taur par deploy karna hai.

1. Cloudflare Dashboard kholein: https://dash.cloudflare.com/
2. **Workers & Pages** mein naya Worker banayein, misal ke taur par `apna-video-api`.
3. `worker.js` ka poora code Worker editor mein paste karke deploy karein.
4. Worker ke **Settings > Variables and Secrets** mein:
   - `REPLICATE_API_TOKEN` ko **Secret** ke taur par add karein. Token Replicate account se milta hai.
   - `REPLICATE_MODEL` ko normal text variable ke taur par add karein. Default `prunaai/p-video` hai; pehle isi ko rehne dein. Model schema: https://replicate.com/prunaai/p-video/api/schema.
5. Worker ko dobara deploy karein.
6. `https://YOUR-WORKER-URL/health` khol kar `configured: true` check karein. Phir website par Backend URL save karke **Test** button dabayein.
7. Website kholein, **Backend URL** mein Worker ka base URL paste karein aur **Save** dabayein.

Replicate: https://replicate.com/  
Pricing: https://replicate.com/pricing

**Kharcha:** Replicate par P-Video ki listed pricing 720p ke liye taqreeban $0.02 per second aur 1080p ke liye $0.04 per second hai. 8-second video taqreeban $0.16 (720p) ya $0.32 (1080p) ho sakti hai. Current pricing: https://replicate.com/prunaai/p-video/readme. Token ke baghair real video generate nahi hogi.

## Zaroori provider compatibility note

`worker.js` default `prunaai/p-video` ko prompt, duration, aspect ratio, resolution, prompt upsampling aur audio setting bhejta hai. Safety filter enabled rakha gaya hai. Agar model badlein to us model ka schema aur code dono check karein.

## Security

- **Public users ko link dene se pehle abuse protection lagayein.** CORS sirf browser-origin control hai, login ya API abuse protection nahi. Public launch se pehle Cloudflare Rate Limiting / Turnstile ya doosri server-side protection configure karein; warna koi direct API call karke aapke Replicate credits kharch kar sakta hai.

- Kabhi bhi Replicate token ko `index.html`, GitHub repository, screenshots ya public messages mein paste na karein.
- Token sirf Cloudflare Worker ke Secret field mein rakhein.
- GitHub Pages par sirf frontend files public hoti hain.
- Browser mein saved projects usi browser/device par rehte hain; abhi cloud account ya cross-device sync nahi hai.

## File structure

- `index.html` — website frontend
- `worker.js` — secure API backend starter
- `README.md` — Roman Urdu setup guide

## Current limitations

- User accounts aur cloud project sync abhi nahi hain.
- Voice-over generation aur scene-by-scene editing abhi implemented nahi hain.
- Provider/model ke mutabiq output video format aur input schema farq ho sakta hai.
- Backend aur provider token configure kiye baghair real AI video generation active nahi hoti.
