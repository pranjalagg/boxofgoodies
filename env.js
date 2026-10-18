// Which bucket of data this build writes to. Stays 'dev' in the repo, so local testing
// never touches production data. The GitHub Pages workflow overwrites it with 'prod'.
export const ENV = 'dev';
