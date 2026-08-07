# Provider Adapter Foundation Design

## Context

Grok Studio Pro already supports xAI/NewAPI, ModelScope, and Hugging Face, but the three image transports are implemented as branches inside `src/lib/xai.ts`. Routes call a stable set of facade functions, while settings assume one selected provider and one credential per provider type.

The long-term product direction is to aggregate multiple free channels and possibly account pools. Specific reverse-channel protocols and the pool deployment location are not selected. The first renovation increment therefore creates a stable image-provider boundary without inventing pool behavior or changing the product UI.

## Goal

Extract current image generation and image editing into provider adapters selected through a registry, while preserving all existing routes, settings, request payloads, errors, cancellation, and generated result shapes.

## Scope

Included:

- A shared image-provider contract.
- A registry for the three current providers.
- Separate xAI/NewAPI, ModelScope, and Hugging Face image adapters.
- A compatibility facade in `src/lib/xai.ts`.
- Unit tests for registry selection and capability enforcement.

Excluded:

- Account pools, rotation, quotas, cooldowns, health scoring, or fallback.
- Reverse-engineered channel code.
- A local or hosted backend gateway.
- Settings schema or UI changes.
- Migration of video, chat completion, video polling, or file conversion.

## Architecture

`src/lib/providers/types.ts` owns the common image request/result types and the `ImageProviderAdapter` interface. Every adapter must implement text-to-image. Image editing is optional and its absence represents an unsupported capability.

`src/lib/providers/registry.ts` owns the adapter map, runtime provider lookup, runtime labels, and the image-edit capability guard. It is the only module that selects a concrete adapter by `ProviderId`. Settings-page catalog text remains in `settings.ts` for compatibility in this increment; consolidating UI metadata is deferred until settings migration.

Each provider module owns its credentials, endpoint construction, payload translation, response normalization, and asynchronous polling behavior. The existing payloads and error messages are moved without semantic changes.

`src/lib/xai.ts` remains the public compatibility facade used by routes. `generateImages()` and `editImages()` load the selected provider and delegate through the registry. Existing video and chat functions remain in this file for this increment.

## Data Flow

1. A route calls the existing `generateImages()` or `editImages()` facade.
2. The facade loads the current settings and requests the matching adapter from the registry.
3. The adapter loads its provider-owned credential/model configuration, translates the common request, and performs the request.
4. The adapter returns the existing `GeneratedImage[]` shape.
5. Routes and gallery persistence continue unchanged.

## Error Handling

- Unknown provider lookup throws an explicit provider configuration error.
- Image editing against ModelScope or Hugging Face throws the existing user-facing unsupported-provider message.
- Provider HTTP errors continue through `assertResponseOk()`.
- ModelScope polling continues to honor abort signals, terminal failures, and timeout bounds.
- No retry or fallback is added in this increment.

## Testing

- Registry tests first verify all configured IDs resolve to the correct adapter.
- Tests verify xAI exposes image editing while ModelScope and Hugging Face are rejected with provider-specific messages.
- Existing model resolution, HTTP, polling, persistence, and object URL tests remain green.
- TypeScript and production build verify that all route-facing imports remain compatible.

## Future Extension Point

A future channel adds one adapter module and one registry entry. Account selection and cross-provider scheduling will be a separate orchestration layer above this registry, so pool policy does not enter route components or provider transports.
