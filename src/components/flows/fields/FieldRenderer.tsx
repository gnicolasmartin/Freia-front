"use client";

import type { FlowVariable, ToolParamMapping } from "@/types/flow";
import TextField from "./TextField";
import TextareaField from "./TextareaField";
import SelectField from "./SelectField";
import ToggleField from "./ToggleField";
import NumberField from "./NumberField";
import KeyValueListField, { type KeyValuePair } from "./KeyValueListField";
import ConditionRulesField, {
  type ConditionRule,
} from "./ConditionRulesField";
import ToolParamMappingField from "./ToolParamMappingField";

// --- Field type definitions ---

interface BaseField {
  key: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
}

interface TextFieldConfig extends BaseField {
  type: "text";
  monospace?: boolean;
}

interface TextareaFieldConfig extends BaseField {
  type: "textarea";
  rows?: number;
  templateHighlight?: boolean;
}

interface SelectFieldConfig extends BaseField {
  type: "select";
  options: readonly { value: string; label: string }[];
}

interface NumberFieldConfig extends BaseField {
  type: "number";
  min?: number;
  max?: number;
}

interface ToggleFieldConfig extends BaseField {
  type: "toggle";
}

interface KeyValueListFieldConfig extends BaseField {
  type: "key-value-list";
  keyLabel: string;
  valueLabel: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

interface ConditionRulesFieldConfig extends BaseField {
  type: "condition-rules";
}

interface VariableSelectFieldConfig extends BaseField {
  type: "variable-select";
}

interface ToolParamMappingFieldConfig extends BaseField {
  type: "tool-param-mapping";
  toolKey: string;
}

export type NodeFieldConfig =
  | TextFieldConfig
  | TextareaFieldConfig
  | SelectFieldConfig
  | ToggleFieldConfig
  | NumberFieldConfig
  | KeyValueListFieldConfig
  | ConditionRulesFieldConfig
  | VariableSelectFieldConfig
  | ToolParamMappingFieldConfig;

export interface NodeTypeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  fields: NodeFieldConfig[];
}

// --- Renderer ---

interface FieldRendererProps {
  field: NodeFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  flowVariables?: FlowVariable[];
  nodeData?: Record<string, unknown>;
  useStock?: boolean;
}

export default function FieldRenderer({
  field,
  value,
  onChange,
  flowVariables = [],
  nodeData,
  useStock = false,
}: FieldRendererProps) {
  switch (field.type) {
    case "text":
      return (
        <TextField
          value={(value as string) || ""}
          onChange={onChange}
          placeholder={
            field.placeholder || `Ingresa ${field.label.toLowerCase()}...`
          }
          monospace={field.monospace}
        />
      );

    case "textarea":
      return (
        <TextareaField
          value={(value as string) || ""}
          onChange={onChange}
          placeholder={
            field.placeholder || `Ingresa ${field.label.toLowerCase()}...`
          }
          rows={field.rows}
          templateHighlight={field.templateHighlight}
          flowVariables={flowVariables}
          useStock={useStock}
        />
      );

    case "select":
      return (
        <SelectField
          value={(value as string) || ""}
          onChange={onChange}
          options={field.options}
          placeholder={field.placeholder}
        />
      );

    case "number":
      return (
        <NumberField
          value={value as number | undefined}
          onChange={onChange}
          placeholder={
            field.placeholder || `Ingresa ${field.label.toLowerCase()}...`
          }
          min={field.min}
          max={field.max}
        />
      );

    case "toggle":
      return (
        <ToggleField value={!!value} onChange={onChange} />
      );

    case "key-value-list":
      return (
        <KeyValueListField
          value={(value as KeyValuePair[]) || []}
          onChange={onChange}
          keyLabel={field.keyLabel}
          valueLabel={field.valueLabel}
          keyPlaceholder={field.keyPlaceholder}
          valuePlaceholder={field.valuePlaceholder}
        />
      );

    case "condition-rules":
      return (
        <ConditionRulesField
          value={(value as ConditionRule[]) || []}
          onChange={onChange}
          flowVariables={flowVariables}
        />
      );

    case "variable-select": {
      const options = flowVariables.map((v) => ({
        value: v.name,
        label: `${v.name} (${v.type})`,
      }));
      return (
        <SelectField
          value={(value as string) || ""}
          onChange={onChange}
          options={options}
          placeholder={
            options.length === 0
              ? "No hay variables definidas"
              : field.placeholder || "Seleccionar variable..."
          }
        />
      );
    }

    case "tool-param-mapping": {
      const currentTool = (nodeData?.[field.toolKey] as string) || "";
      return (
        <ToolParamMappingField
          value={(value as ToolParamMapping[]) || []}
          onChange={onChange}
          tool={currentTool}
          flowVariables={flowVariables}
        />
      );
    }

    default:
      return null;
  }
}
