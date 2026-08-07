# Free Provider Expansion Design

## Context

Grok Studio Pro now has an image-provider registry for xAI/NewAPI, ModelScope, and Hugging Face. The renovation direction is to aggregate free and account-pool channels. This increment adds two documented public transports and makes the supplied PixAI account-pool site a first-class, explicitly blocked provider until its private web protocol can be captured.

## Goals

- Add working AI Horde text-to-image generation with anonymous-key fallback.
- Add working Pollinations text-to-image generation with an explicit API key.
- Add PixAI pool settings, catalog metadata, registry presence, and a precise protocol-required error without fabricating a request contract.
- Preserve existing route APIs, gallery result shape, abort signals, and provider capability behavior.

## Non-goals

- Cross-provider fallback, scoring, rotation, or quota scheduling.
- Image editing or video support for the new providers.
- Circumventing the PixAI pool website's access controls or guessing its private endpoints.
- Claiming PixAI pool generation works before a real request trace is supplied.

## Architecture

`ProviderId` gains `aihorde`, `pollinations`, and `pixai-pool`. Each provider remains a focused adapter registered in `src/lib/providers/index.ts`. AI Horde protocol state lives in a tested polling client, Pollinations owns URL construction and binary response normalization, and PixAI pool owns only protocol readiness validation.

All new providers return the existing `GeneratedImage[]` type. Multi-image requests run serially at the adapter boundary, matching the user's constrained free-channel concurrency requirement and the existing ModelScope/Hugging Face behavior.

## Configuration

- AI Horde: optional key; empty means anonymous key `0000000000`.
- Pollinations: required API key and configurable model, default `flux`.
- PixAI pool: base site URL stored for future transport configuration. The settings page explains that request protocol capture is still required.

## Error Handling

- AI Horde rejects missing task IDs, faulted jobs, missing completed generations, HTTP errors, aborts, and bounded polling timeouts with provider-specific messages.
- Pollinations rejects a missing key before network I/O and uses checked HTTP responses.
- PixAI pool always rejects before network I/O with instructions to provide a HAR or Network request details.

## UI

The settings page retains its current single-provider select and conditional fields. New controls use existing `Label`, `Input`, and password visibility conventions. Provider descriptions state operational constraints rather than promising unverified free capacity.

## Testing

- AI Horde tests cover submit payload, anonymous/key headers, queue polling, successful normalization, terminal failure, timeout, and abort.
- Pollinations tests cover encoded prompts, dimensions, model/key parameters, and missing-key validation.
- Registry, catalog, settings defaults, TypeScript, lint, production build, and local settings rendering remain verified.
