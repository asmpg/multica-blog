export interface ContentIssue {
  file: string;
  field?: string;
  reason: string;
}

export class ContentValidationError extends Error {
  readonly issues: ContentIssue[];

  constructor(issues: ContentIssue[]) {
    super(
      `内容校验失败（${issues.length} 项）：\n` +
        issues
          .map((issue) => `- ${issue.file}${issue.field ? ` → ${issue.field}` : ''}：${issue.reason}`)
          .join('\n'),
    );
    this.name = 'ContentValidationError';
    this.issues = issues;
  }
}

export class Issues {
  readonly list: ContentIssue[] = [];

  add(file: string, reason: string, field?: string): void {
    this.list.push({ file, field, reason });
  }

  throwIfAny(): void {
    if (this.list.length > 0) {
      throw new ContentValidationError(this.list);
    }
  }
}
