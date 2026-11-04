# On_Haru

Original app: https://onharu.myeram.chatgpt.site/legacy/

The original app files are preserved in `public/legacy/`. The root redirects to `/legacy/`.

## Local preview

```sh
python3 -m http.server 8080 --directory public
```

Open http://localhost:8080/legacy/.

## Static deployment

Deploy the `public` directory. No build command or dependencies are required.
For Cloudflare Pages, select this repository, leave the build command empty, and set the output directory to `public`.

Personal records remain in the browser storage of the original origin. They do not automatically transfer to a different domain. Export a JSON backup in the original app before switching domains, then import it in the new app.
