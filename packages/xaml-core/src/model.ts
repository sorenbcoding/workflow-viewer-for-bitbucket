/** Plain data model for a parsed UiPath workflow. No DOM or React types, so any renderer can use it. */

export type ArgumentDirection = 'In' | 'Out' | 'InOut' | 'Property';

export interface WorkflowArgument {
  name: string;
  direction: ArgumentDirection;
  /** .NET type as written in the XAML, e.g. `x:String` or `scg:Dictionary(x:String, x:Object)`. */
  type: string;
  defaultValue?: string;
  annotation?: string;
}

export interface WorkflowVariable {
  name: string;
  type: string;
  defaultValue?: string;
  /** Display name of the activity that declares the variable. */
  scope: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ViewState {
  location?: Point;
  size?: Size;
  isExpanded?: boolean;
  /** Connector points keyed by ViewState key, e.g. `ConnectorLocation`, `TrueConnector`. */
  connectors?: Record<string, Point[]>;
}

/** A named group of child activities, e.g. `Then`, `Else`, `Catch (Exception)`, `Body`. */
export interface ActivitySlot {
  name: string;
  /** Name of the delegate argument, e.g. `item` in a For Each or `exception` in a Catch. */
  argument?: string;
  children: ActivityNode[];
}

interface ActivityBase {
  /** Stable id within the document: the `IdRef` if present, otherwise a generated one. */
  id: string;
  /** Qualified XAML tag, e.g. `ui:LogMessage` or `Sequence`. */
  type: string;
  /** Tag without its prefix, e.g. `LogMessage`. */
  localType: string;
  displayName: string;
  annotation?: string;
  /** Attribute and property-element values, expressions kept as written. */
  properties: Record<string, string>;
  variables: WorkflowVariable[];
  viewState?: ViewState;
  /** False when Studio stored the activity collapsed. */
  isExpanded?: boolean;
  /** Full .NET type as Studio shows it, e.g. `UiPath.Excel.Activities.Business.ReadRangeX`. */
  fullType?: string;
  /** True when the namespace was looked up from a shared schema URI instead of read from a `clr-namespace` mapping. */
  fullTypeInferred?: boolean;
}

export interface GenericActivity extends ActivityBase {
  kind: 'activity';
  slots: ActivitySlot[];
}

export type FlowNodeKind = 'step' | 'decision' | 'switch';

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  displayName: string;
  /** The activity inside a FlowStep. Undefined for decisions, switches and empty steps. */
  activity?: ActivityNode;
  /** Condition for decisions, expression for switches. */
  expression?: string;
  annotation?: string;
  viewState?: ViewState;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** `True`, `False`, a switch case key, `Default`, or undefined for a plain `Next`. */
  label?: string;
  /** ViewState connector key on the source node that draws this edge, if any. */
  connectorKey?: string;
}

export interface FlowchartActivity extends ActivityBase {
  kind: 'flowchart';
  /** Id of the first node, or undefined when the start node is not connected. */
  startNode?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface StateNode {
  id: string;
  displayName: string;
  isFinal: boolean;
  annotation?: string;
  entry?: ActivityNode;
  exit?: ActivityNode;
  viewState?: ViewState;
}

export interface StateTransition {
  id: string;
  from: string;
  to: string;
  displayName: string;
  condition?: string;
  trigger?: ActivityNode;
  action?: ActivityNode;
  annotation?: string;
  connector?: Point[];
}

export interface StateMachineActivity extends ActivityBase {
  kind: 'stateMachine';
  initialState?: string;
  states: StateNode[];
  transitions: StateTransition[];
}

export type ActivityNode = GenericActivity | FlowchartActivity | StateMachineActivity;

export interface WorkflowDocument {
  /** `x:Class` of the root, e.g. `Main`. */
  className?: string;
  annotation?: string;
  expressionLanguage: 'VisualBasic' | 'CSharp' | 'Unknown';
  arguments: WorkflowArgument[];
  /** The root activity. Undefined for an empty workflow. */
  root?: ActivityNode;
  /** Non-fatal problems found while parsing, written as `<what> — <why>. <fix>.` */
  warnings: string[];
}

export interface InvokeReference {
  /** Id of the Invoke Workflow File activity. */
  activityId: string;
  displayName: string;
  /** Path as written in `WorkflowFileName`, with forward slashes. */
  target: string;
  /** True when the path is an expression that is only known at run time. */
  isDynamic: boolean;
}
