export class GoogleWorkspaceApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, input: { status: number; code: string }) {
    super(message);
    this.name = "GoogleWorkspaceApiError";
    this.status = input.status;
    this.code = input.code;
  }
}
