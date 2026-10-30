import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildInvokeTree,
  findInvokes,
  formatExpression,
  normalisePath,
  parseProjectJson,
  parseWorkflow,
  type ActivityNode,
  type GenericActivity,
  type WorkflowDocument,
} from '../src/index.js';

const sampleDir = fileURLToPath(new URL('../../../samples/InvoiceProcessing/', import.meta.url));
const read = (rel: string) => readFileSync(sampleDir + rel, 'utf-8');
const load = (rel: string) => parseWorkflow(read(rel));

const generic = (n: ActivityNode | undefined): GenericActivity => {
  if (!n || n.kind !== 'activity') throw new Error(`expected a generic activity, got ${n?.kind}`);
  return n;
};
const slot = (n: ActivityNode | undefined, name: string) => {
  const s = generic(n).slots.find((x) => x.name === name);
  if (!s) throw new Error(`slot "${name}" not found on ${n?.displayName}`);
  return s;
};

describe('sequence workflows', () => {
  const doc = load('Framework/InitAllSettings.xaml');

  it('reads class name, arguments and language', () => {
    expect(doc.className).toBe('InitAllSettings');
    expect(doc.arguments).toEqual([
      { name: 'out_Config', direction: 'Out', type: 'Dictionary(String, Object)', defaultValue: undefined, annotation: undefined },
    ]);
    expect(doc.expressionLanguage).toBe('VisualBasic');
    expect(doc.warnings).toEqual([]);
  });

  it('reads the root sequence, its annotation with line breaks and its variables', () => {
    const root = generic(doc.root);
    expect(root.displayName).toBe('Init All Settings');
    expect(root.id).toBe('Sequence_1');
    expect(root.annotation).toBe('Reads Config.xlsx into a dictionary.\nSettings and Constants sheets are read the same way.');
    expect(root.variables.map((v) => [v.name, v.type, v.defaultValue])).toEqual([
      ['dtSettings', 'DataTable', undefined],
      ['configPath', 'String', 'Data\\Config.xlsx'],
    ]);
    expect(slot(root, '').children.map((c) => c.displayName)).toEqual(['Create dictionary', 'Use Excel File', 'For Each Row in Settings']);
  });

  it('reads Assign properties from property elements', () => {
    const assign = generic(slot(doc.root, '').children[0]);
    expect(assign.properties.To).toBe('[out_Config]');
    expect(assign.properties.Value).toBe('[New Dictionary(Of String, Object)]');
  });

  it('reads ActivityAction bodies as slots with their argument', () => {
    const excel = slot(doc.root, '').children[1];
    const body = slot(excel, 'Body');
    expect(body.argument).toBe('Excel');
    expect(body.children[0].displayName).toBe('Do');
    expect(excel.properties.WorkbookPath).toBe('[configPath]');
    expect(excel.properties.Password).toBeUndefined();

    const forEach = slot(doc.root, '').children[2];
    expect(slot(forEach, 'Body').argument).toBe('row');
  });

  it('reads If with Then and Else', () => {
    const forEach = slot(doc.root, '').children[2];
    const theIf = slot(slot(forEach, 'Body').children[0], '').children[0];
    expect(theIf.localType).toBe('If');
    expect(theIf.properties.Condition).toBe('[Not String.IsNullOrWhiteSpace(row("Name").ToString)]');
    expect(slot(theIf, 'Then').children[0].displayName).toBe('Add setting');
    expect(slot(theIf, 'Else').children[0].properties.Level).toBe('Warn');
  });
});

describe('try catch, UI automation, switch and unknown activities', () => {
  const doc = load('Process.xaml');
  const root = generic(doc.root);
  const tryCatch = slot(root, '').children[0];

  it('reads all argument directions', () => {
    expect(doc.arguments.map((a) => `${a.direction}:${a.name}:${a.type}`)).toEqual([
      'In:in_TransactionItem:QueueItem',
      'In:in_Config:Dictionary(String, Object)',
      'InOut:io_RetryCount:Int32',
    ]);
  });

  it('reads Try, typed Catches and Finally', () => {
    expect(generic(tryCatch).slots.map((s) => s.name)).toEqual(['Try', 'Catch (BusinessRuleException)', 'Catch (Exception)', 'Finally']);
    expect(slot(tryCatch, 'Catch (Exception)').argument).toBe('exception');
    expect(slot(tryCatch, 'Finally').children[0].displayName).toBe('Log finished');
  });

  it('reads invoke arguments and UI targets as properties', () => {
    const steps = slot(slot(tryCatch, 'Try').children[0], '').children;
    expect(steps[0].properties['Arguments.in_TransactionItem']).toBe('[in_TransactionItem]');
    const card = steps[2];
    const typeInto = slot(slot(card, 'Body').children[0], '').children[0];
    expect(typeInto.localType).toBe('NTypeInto');
    expect(typeInto.properties.Target).toContain("FullSelectorArgument=<webctrl id='invoice-number' tag='INPUT' />");
  });

  it('reads Switch cases from x:Key children and keeps unknown activities', () => {
    const sw = slot(slot(tryCatch, 'Try').children[0], '').children[3];
    expect(generic(sw).slots.map((s) => s.name)).toEqual(['Default', 'Case Standard', 'Case Credit']);
    const unknown = slot(sw, 'Case Credit').children[0];
    expect(unknown.type).toBe('acme:PostToLedger');
    expect(unknown.properties).toEqual({ Amount: '[total]', Ledger: 'Credit' });
  });

  it('finds static and dynamic invokes', () => {
    expect(findInvokes(doc).map((i) => [i.target, i.isDynamic])).toEqual([
      ['Framework/ValidateInvoice.xaml', false],
      ['Framework/CalculateTotals.xaml', false],
      ['"Handlers\\" + invoiceType + ".xaml"', true],
    ]);
  });
});

describe('flowchart', () => {
  const doc = load('Framework/ValidateInvoice.xaml');
  const fc = doc.root!;

  it('reads nodes with positions and resolves references', () => {
    if (fc.kind !== 'flowchart') throw new Error('expected flowchart');
    expect(fc.startNode).toBe('__ReferenceID0');
    expect(fc.isExpanded).toBe(false);
    expect(fc.viewState?.location).toEqual({ x: 270, y: 2.5 });
    expect(fc.nodes.map((n) => `${n.kind}:${n.displayName}`)).toEqual([
      'step:Read invoice number',
      'decision:Invoice number missing?',
      'step:Throw business exception',
      'switch:Check currency',
      'step:Log EUR invoice',
      'step:Log DKK invoice',
    ]);
    expect(fc.nodes[0].viewState?.location).toEqual({ x: 200, y: 110 });
    expect(fc.nodes[1].expression).toBe('[String.IsNullOrEmpty(out_InvoiceNumber)]');
    expect(fc.variables.map((v) => v.name)).toEqual(['currency']);
  });

  it('reads edges with labels and connector keys', () => {
    if (fc.kind !== 'flowchart') throw new Error('expected flowchart');
    expect(fc.edges).toHaveLength(6);
    expect(fc.edges).toEqual(expect.arrayContaining([
      { from: '__ReferenceID0', to: '__ReferenceID1', label: undefined, connectorKey: 'ConnectorLocation' },
      { from: '__ReferenceID1', to: '__ReferenceID2', label: 'True', connectorKey: 'TrueConnector' },
      { from: '__ReferenceID3', to: '__ReferenceID2', label: 'Default', connectorKey: 'DefaultConnector' },
      { from: '__ReferenceID3', to: '__ReferenceID4', label: 'EUR', connectorKey: undefined },
      { from: '__ReferenceID3', to: '__ReferenceID5', label: 'DKK', connectorKey: undefined },
      { from: '__ReferenceID1', to: '__ReferenceID3', label: 'False', connectorKey: 'FalseConnector' },
    ]));
    expect(doc.warnings).toEqual([]);
  });
});

describe('state machine', () => {
  const doc = load('Main.xaml');
  const sm = doc.root!;

  it('reads states, final state and entry activities', () => {
    if (sm.kind !== 'stateMachine') throw new Error('expected state machine');
    expect(doc.annotation).toContain('Synthetic sample');
    expect(doc.arguments[0].annotation).toBe('Folder with the invoice files to process.');
    expect(sm.initialState).toBe('__ReferenceID0');
    expect(sm.states.map((s) => [s.displayName, s.isFinal])).toEqual([
      ['Initialization', false],
      ['Get Transaction Data', false],
      ['Process Transaction', false],
      ['End Process', true],
    ]);
    expect(sm.states[0].entry?.displayName).toBe('Initialization actions');
    expect(sm.states[2].viewState?.location).toEqual({ x: 250, y: 450 });
  });

  it('reads transitions in element, attribute and reference form', () => {
    if (sm.kind !== 'stateMachine') throw new Error('expected state machine');
    expect(sm.transitions.map((t) => `${t.from}->${t.to}:${t.displayName}:${t.condition ?? ''}`)).toEqual([
      '__ReferenceID2->__ReferenceID1:Next:',
      '__ReferenceID1->__ReferenceID2:New Transaction:[hasItem]',
      '__ReferenceID1->__ReferenceID3:No Data:[Not hasItem]',
      '__ReferenceID0->__ReferenceID1:Successful:',
    ]);
    expect(sm.transitions[0].connector).toHaveLength(4);
  });

  it('finds invokes inside state entries', () => {
    expect(findInvokes(doc).map((i) => i.target)).toEqual(['Framework/InitAllSettings.xaml', 'Process.xaml']);
  });
});

describe('C# expressions', () => {
  const doc = load('Framework/CalculateTotals.xaml');

  it('detects the language and reads expression elements as text', () => {
    expect(doc.expressionLanguage).toBe('CSharp');
    const forEach = slot(doc.root, '').children[0];
    expect(forEach.properties.Values).toBe('in_Lines');
    const assign = slot(forEach, 'Body').children[0];
    expect(assign.properties.Value).toBe('out_Total + line');
    const loop = slot(doc.root, '').children[1];
    expect(loop.properties.Condition).toBe('out_Total < 0');
    expect(slot(loop, '').children[0].displayName).toBe('Reset total');
  });
});

describe('robustness', () => {
  it('throws a readable error for malformed XML', () => {
    expect(() => parseWorkflow('<Activity><Sequence></Activity>')).toThrow(/not well-formed XML/);
  });

  it('handles an empty workflow and a byte order mark', () => {
    const doc = parseWorkflow('﻿<Activity x:Class="Empty" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" />');
    expect(doc.className).toBe('Empty');
    expect(doc.root).toBeUndefined();
  });

  it('warns about flowchart references that do not resolve', () => {
    const doc = parseWorkflow(`<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
      <Flowchart DisplayName="Broken"><FlowStep x:Name="a"><Sequence DisplayName="S" /><FlowStep.Next><x:Reference>missing</x:Reference></FlowStep.Next></FlowStep></Flowchart></Activity>`);
    expect(doc.warnings[0]).toMatch(/1 connector\(s\) to missing steps/);
    expect(doc.root?.kind === 'flowchart' && doc.root.edges).toEqual([]);
  });
});

describe('project.json and invoke tree', () => {
  const project = parseProjectJson(read('project.json'));
  const files = ['Main.xaml', 'Process.xaml', 'Framework/InitAllSettings.xaml', 'Framework/ValidateInvoice.xaml', 'Framework/CalculateTotals.xaml'];
  const workflows = new Map<string, WorkflowDocument>(files.map((f) => [f, load(f)]));

  it('reads the project metadata', () => {
    expect(project).toMatchObject({
      name: 'InvoiceProcessing',
      outputType: 'Process',
      targetFramework: 'Windows',
      expressionLanguage: 'VisualBasic',
      studioVersion: '24.10.5.0',
      main: 'Main.xaml',
      entryPoints: [{ filePath: 'Main.xaml', uniqueId: '5a1f7e0c-2b9d-4e63-8c4a-7d2e9f1b3a56' }],
    });
    expect(project.dependencies.map((d) => d.name)).toContain('UiPath.Excel.Activities');
  });

  it('builds the call tree from the entry point', () => {
    const tree = buildInvokeTree('Main.xaml', workflows);
    const flat = (n: typeof tree, depth = 0): string[] => [
      `${'  '.repeat(depth)}${n.path}${n.isDynamic ? ' (dynamic)' : ''}${n.exists ? '' : ' (missing)'}`,
      ...n.children.flatMap((c) => flat(c, depth + 1)),
    ];
    expect(flat(tree)).toEqual([
      'Main.xaml',
      '  Framework/InitAllSettings.xaml',
      '  Process.xaml',
      '    Framework/ValidateInvoice.xaml',
      '    Framework/CalculateTotals.xaml',
      '    "Handlers\\" + invoiceType + ".xaml" (dynamic) (missing)',
    ]);
  });

  it('normalises paths and expressions', () => {
    expect(normalisePath('.\\Framework\\..\\Process.xaml')).toBe('Process.xaml');
    expect(formatExpression('[a + b]')).toBe('a + b');
    expect(() => parseProjectJson('{')).toThrow(/not valid JSON/);
  });
});

describe('full activity types', () => {
  const process = load('Process.xaml');
  const steps = slot(slot(slot(process.root, '').children[0], 'Try').children[0], '').children;

  it('reads exact namespaces from clr-namespace prefixes', () => {
    const init = load('Framework/InitAllSettings.xaml');
    const excel = slot(slot(slot(init.root, '').children[1], 'Body').children[0], '').children[0];
    expect(excel.fullType).toBe('UiPath.Excel.Activities.Business.ReadRangeX');
    expect(excel.fullTypeInferred).toBe(false);
    const unknown = slot(steps[3], 'Case Credit').children[0];
    expect(unknown.fullType).toBe('Acme.Synthetic.Activities.PostToLedger');
  });

  it('infers namespaces from schema URIs', () => {
    expect(process.root?.fullType).toBe('System.Activities.Statements.Sequence');
    expect(process.root?.fullTypeInferred).toBe(true);
    expect(steps[0].fullType).toBe('UiPath.Core.Activities.InvokeWorkflowFile');
    const click = slot(slot(steps[2], 'Body').children[0], '').children[1];
    expect(click.fullType).toBe('UiPath.UIAutomationNext.Activities.NClick');
  });

  it('appends type arguments for generic activities', () => {
    const totals = load('Framework/CalculateTotals.xaml');
    expect(slot(totals.root, '').children[0].fullType).toBe('UiPath.Core.Activities.ForEach<Decimal>');
  });
});

describe('nested property values', () => {
  const process = load('Process.xaml');
  const steps = slot(slot(slot(process.root, '').children[0], 'Try').children[0], '').children;
  const filter = steps[4];

  it('shows filter rows with column, operator and operand', () => {
    expect(filter.localType).toBe('FilterDataTable');
    expect(filter.properties.Filters).toBe('"Age" > 18\nOr "Name" not empty');
    expect(filter.properties.SelectColumns).toBe('["Name"]\n["Age"]');
  });

  it('only strips brackets that wrap the whole expression', () => {
    expect(formatExpression('["a"] [18]')).toBe('["a"] [18]');
    expect(formatExpression('[x]')).toBe('x');
    expect(formatExpression('[row("[a]")]')).toBe('row("[a]")');
  });
});
