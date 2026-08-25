You are an expert Haskell compiler engineer and frontend developer specializing in the GHC WebAssembly backend, Nix flakes, and functional reactive programming (FRP) with Miso.

### Objective
Create a complete, single-user, read-only Nostr client web application written entirely in Haskell. The app must compile to a `wasm32-wasi` reactor binary utilizing the native GHC Wasm backend via a Nix environment, and be ready for static deployment on Cloudflare Pages.

### Stack Specifications
1. **Build Tooling:** Nix Flakes utilizing `ghc-wasm-meta` (targeting GHC 9.10 or 9.12) to handle cross-compilation with `wasm32-wasi-cabal`.
2. **UI Framework:** `miso` configured to work alongside `jsaddle-wasm`.
3. **Routing/API:** `servant` or native Miso routing to abstract application views.
4. **Nostr Domain Logic:** Integrate `nostr.hs` library to parse events, signatures, and manage cryptographic datatypes natively within the browser context.

### Codebase Requirements

Please generate a cleanly modularized project repository containing the following precise files:

#### 1. `flake.nix`
A declarative Nix environment config that pulls in `ghc-wasm-meta` or custom overlays to expose:
- `wasm32-wasi-ghc`
- `wasm32-wasi-cabal`
- Necessary dependencies like `wasm-opt` for production builds.
Ensure that native build dependencies (like `secp256k1` required by crypto libraries) are correctly mapped for the target.

#### 2. `cabal.project` & `nostr-client.cabal`
- Implement standard configuration setups tailored for cross-compiling to WebAssembly.
- Include a conditional configuration block `if arch(wasm32)` ensuring proper flags are applied for packages that rely heavily on TemplateHaskell (e.g., `aeson` overrides or split configurations if needed).

#### 3. `src/Main.hs`
The application framework. It must execute using the `jsaddle-wasm` entry point (`run` or custom loop execution) running a Miso App.
- **Model:** Track a simple state including: user public key (Hardcoded text or config), loaded Nostr events array, loading statuses, and connection status.
- **Action:** Define data constructors for initializing, loading successful feed data, socket updates, and changing UI views.
- **View:** Implement an all-Haskell HTML structure using Miso's type-safe HTML tags. Render a clean reader interface presenting Nostr Text Notes (Kind 1), display the author's abbreviated PubKey, timestamp, and content body.

#### 4. `src/NostrInterface.hs`
Bridge standard JS-based browser WebSockets to the pure Haskell runtime. 
- Avoid using `connectRelays` from `nostr.hs` directly if it forces native platform threads (`forkIO`) that conflict with the single-threaded JS runtime event loop.
- Instead, implement a lightweight listener pattern using JSFFI hooks or Miso subscription models to connect to a public relay (e.g., `wss://relay.damus.io`), transmit a valid subscription REQ JSON string filter targeting your specified pubkey, and yield incoming event strings directly into the Miso `Action` pipeline.
- Leverage structural types from `nostr.hs` (`Event`, `PubKey`) to decode and sanitize incoming data via `Data.Aeson`.

#### 5. `static/index.html` & Build Scripts
- A skeleton `index.html` file that hooks up the compiled output `.wasm` app along with any required boilerplate initialization glue code provided by `jsaddle-wasm`.
- A simple build script or Make macro execution task that compiles the Haskell application to `wasm32-wasi`, optimizes it with `wasm-opt -O3`, and gathers the resulting assets directly into a `/dist` output directory ready for Cloudflare Pages deployment.

Write pure, production-grade, type-safe code. Avoid using `undefined` placeholders or shorthand stubs—implement the architecture exhaustively.
