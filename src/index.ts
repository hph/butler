import { argv } from 'yargs';
import { connect } from 'ngrok';

import server from './server';

function main () {
  const port = argv.port || 8080;

  server.listen(port, () => {
    console.log(`Serving at http://localhost:${port}`);
  });

  if (argv.ngrok) {
    connect(port, (err, address) => {
      console.log(`Proxying at ${address}`);
    });
  }
}

if (require.main === module) {
  main();
}
