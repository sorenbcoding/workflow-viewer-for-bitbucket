import type { ActivityNode } from '@sorenb/xaml-core';
import { formatExpression } from '@sorenb/xaml-core';

export type ActivityFamily =
  | 'sequence' | 'flow' | 'condition' | 'loop' | 'error' | 'invoke' | 'ui' | 'excel' | 'mail' | 'log' | 'data' | 'queue' | 'generic';

const RULES: [ActivityFamily, RegExp][] = [
  ['flow', /^(Flowchart|StateMachine|State|FlowStep)$/],
  ['sequence', /^(Sequence|Parallel|Pick|PickBranch)$/],
  ['condition', /^(If|IfElseIf|Switch|FlowDecision|FlowSwitch)$/],
  ['loop', /(ForEach|While|DoWhile|Repeat|Loop)/],
  ['error', /^(TryCatch|Throw|Rethrow|RetryScope|Catch)$/],
  ['invoke', /^(Invoke|Run|Start).*(Workflow|Process|Code|Job)|^InvokeWorkflowFile$/],
  ['excel', /(Excel|Workbook|ReadRange|WriteRange|WriteCell|ReadCell|AppendRange|Sheet)/],
  ['mail', /(Mail|Outlook|Exchange|Smtp|Imap|Pop3|Gmail)/],
  ['queue', /(Queue|Transaction)/],
  ['ui', /^N[A-Z]|(Click|TypeInto|Hotkey|SendHotkey|Element|Window|Browser|Application|GetText|SetText|Selector|Screen|Hover|Highlight|Attach|Open|Close)/],
  ['log', /^(LogMessage|WriteLine|Comment|CommentOut|MessageBox)$/],
  ['data', /(Assign|DataTable|DataRow|Dictionary|Collection|Variable|Filter|Join|Lookup|Sort)/],
];

export function familyOf(localType: string): ActivityFamily {
  return RULES.find(([, re]) => re.test(localType))?.[0] ?? 'generic';
}

const PATHS: Record<ActivityFamily, JSX.Element> = {
  sequence: <path d="M3 4h10M3 8h10M3 12h10" />,
  flow: <><rect x="2" y="2" width="5" height="4" /><rect x="9" y="10" width="5" height="4" /><path d="M4.5 6v6H9" /></>,
  condition: <path d="M8 2l6 6-6 6-6-6z" />,
  loop: <><path d="M13 8a5 5 0 1 1-1.5-3.5" /><path d="M12 2v3h-3" /></>,
  error: <><path d="M8 2l6 11H2z" /><path d="M8 7v2.5M8 11.5v.5" /></>,
  invoke: <><rect x="6" y="3" width="8" height="10" /><path d="M1 8h7M6 6l2 2-2 2" /></>,
  ui: <path d="M4 2l8 6-4 1 2 4-1.5.8-2-4L4 12z" />,
  excel: <><rect x="2" y="2" width="12" height="12" /><path d="M2 6h12M2 10h12M7 2v12" /></>,
  mail: <><rect x="2" y="4" width="12" height="9" /><path d="M2 4l6 5 6-5" /></>,
  log: <><path d="M3 3h10v10H3z" /><path d="M5 6h6M5 8.5h6M5 11h3" /></>,
  data: <path d="M3 6h10M3 10h10" />,
  queue: <><rect x="3" y="2" width="10" height="3" /><rect x="3" y="6.5" width="10" height="3" /><rect x="3" y="11" width="10" height="3" /></>,
  generic: <rect x="3" y="3" width="10" height="10" />,
};

export function ActivityIcon({ family, title }: { family: ActivityFamily; title?: string }) {
  return (
    <svg className="sbv-icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {PATHS[family]}
    </svg>
  );
}

const shorten = (s: string, max = 90) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** One-line preview shown under the activity name, like the text Studio shows inside the designer. */
export function summaryOf(node: ActivityNode): string | undefined {
  const p = node.properties;
  const e = (k: string) => (p[k] ? formatExpression(p[k]) : undefined);
  switch (node.localType) {
    case 'Assign':
      return p.To && p.Value ? shorten(`${e('To')} = ${e('Value')}`) : undefined;
    case 'If':
    case 'While':
    case 'DoWhile':
      return e('Condition') && shorten(e('Condition')!);
    case 'Switch':
      return e('Expression') && shorten(e('Expression')!);
    case 'LogMessage':
      return e('Message') && shorten(`${p.Level ?? 'Info'}: ${e('Message')}`);
    case 'InvokeWorkflowFile':
      return e('WorkflowFileName');
    case 'Throw':
      return e('Exception') && shorten(e('Exception')!);
    case 'Delay':
      return e('Duration');
  }
  if (/ForEach/.test(node.localType)) return e('Values') ?? e('DataTable');
  const target = p.Target ?? p.FullSelectorArgument ?? p.Selector;
  if (target) {
    const sel = target.match(/(?:FullSelectorArgument|Selector)=(.*?)(?:, \w+=|\s}$|$)/)?.[1];
    if (sel) return shorten(sel);
  }
  return undefined;
}
