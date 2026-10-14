# Cairnwise mobile client

The implementation is in `mobile/`. It is an Expo SDK 51 TypeScript client using only Supabase public project configuration and the existing `/v1` API. See [`mobile/README.md`](mobile/README.md) for setup values, Google redirect configuration, Android emulator networking (`10.0.2.2`), commands, and the mobile acceptance checklist.

The client deliberately renders API source states such as `unavailable`, `degraded`, and `not_evaluated`; it does not convert unavailable coverage into an all-clear and does not create local or synthetic records.
