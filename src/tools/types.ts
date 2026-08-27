/** Options shared by all tool registrars. */
export interface ToolOptions {
  /** When true, mutating tools (add/update/delete/import) are not registered. */
  readonly: boolean;
}
