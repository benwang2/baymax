// ---------------------------------------------------------------------------
// Command registration barrel
// ---------------------------------------------------------------------------
// discordx registers slash commands by executing a command module's
// @Discord/@Slash decorators, which happens when the module is imported.
// Importing this barrel therefore registers every command with discordx.
//
// Commands are wired up through this single file (rather than via a runtime
// filesystem glob from @discordx/importer) so that they are statically
// included in the production bundle produced by `bun build` and their
// decorators always run before commands are synced.
//
// To add a new command: create the file in this directory and add a
// side-effect import for it below.
import "./roles";
