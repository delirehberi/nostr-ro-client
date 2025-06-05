# Nostr Readonly Client for Personal Use

I've created this cloudflare worker to read my nostr events (kind:1). You can update the configuration and deploy it to your own cloudflare worker account. 

Preview: [nostr.emre.xyz](https://nostr.emre.xyz)

## Configuration

All configurations can be seen in wrangler.jsonc file. 

## Installation

1. Install [wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-upgrade/).
2. Clone this repository.
3. Run `npx wrangler login` to authenticate with your Cloudflare account.
4. Update the `wrangler.jsonc` file with your Cloudflare account details and any other configurations you need.
5. Deploy the worker using `npx wrangler deploy`.

## Contribution

Feel free to fork this repository and submit pull requests for any improvements or features you would like to add.
