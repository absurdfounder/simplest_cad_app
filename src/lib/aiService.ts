import type { ModelContext, StructuredAction } from '@/types';

const SYSTEM_PROMPT = `You are a CAD design assistant integrated into a 3D model viewer and editor.
You help users modify parametric models by suggesting structured parameter changes.

When the user asks to change a dimension or parameter:
1. Identify which parameter(s) to change
2. Calculate the new value
3. Respond with a JSON action block that the app can apply

Your response MUST include a JSON code block with the action:
\`\`\`json
{
  "action": "update_parameters",
  "target": "<part_name>",
  "changes": {
    "<param_name>": <new_value>
  },
  "description": "<brief description of what changed>"
}
\`\`\`

Available actions:
- update_parameters: Change parameter values
- info: Provide information about the model

If the user asks about measurements or model info, describe what you see in the context.
If a change is not possible with current parameters, explain why and suggest alternatives.
Always be concise and practical. Focus on the engineering task at hand.`;

export async function sendChatMessage(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  modelContext: ModelContext | null
): Promise<{ content: string; action?: StructuredAction }> {
  if (!apiKey) {
    return simulateResponse(messages, modelContext);
  }

  const contextBlock = modelContext
    ? `\n\nCurrent model context:\n${JSON.stringify(modelContext, null, 2)}`
    : '';

  const apiMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Add context to the last user message
  if (apiMessages.length > 0 && contextBlock) {
    const last = apiMessages[apiMessages.length - 1];
    if (last.role === 'user') {
      last.content += contextBlock;
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || 'No response';

    const action = extractAction(content);
    return { content, action: action || undefined };
  } catch (error: any) {
    return {
      content: `Error calling API: ${error.message}. Using simulated response instead.`,
      action: undefined,
    };
  }
}

function simulateResponse(
  messages: Array<{ role: string; content: string }>,
  context: ModelContext | null
): { content: string; action?: StructuredAction } {
  const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || '';

  if (!context) {
    return {
      content:
        'No model is loaded. Please upload an STL/OBJ/GLB file or load the demo model to get started.',
    };
  }

  // Simple pattern matching for common requests
  const slotMatch = lastMsg.match(/slot\s*(?:width)?\s*(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (slotMatch && context.parameters.slot_width_mm !== undefined) {
    const newVal = parseFloat(slotMatch[1]);
    return {
      content: `I'll change the slot width to ${newVal} mm.\n\n\`\`\`json\n${JSON.stringify(
        {
          action: 'update_parameters',
          target: context.model.name,
          changes: { slot_width_mm: newVal },
          description: `Set slot width to ${newVal} mm`,
        },
        null,
        2
      )}\n\`\`\`\n\nClick **Apply** to update the model.`,
      action: {
        action: 'update_parameters',
        target: context.model.name,
        changes: { slot_width_mm: newVal },
        description: `Set slot width to ${newVal} mm`,
      },
    };
  }

  const wallMatch = lastMsg.match(/(?:wall|support)\s*(?:height)?\s*(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (wallMatch && context.parameters.wall_height_mm !== undefined) {
    const newVal = parseFloat(wallMatch[1]);
    return {
      content: `I'll change the wall height to ${newVal} mm.\n\n\`\`\`json\n${JSON.stringify(
        {
          action: 'update_parameters',
          target: context.model.name,
          changes: { wall_height_mm: newVal },
          description: `Set wall height to ${newVal} mm`,
        },
        null,
        2
      )}\n\`\`\`\n\nClick **Apply** to update the model.`,
      action: {
        action: 'update_parameters',
        target: context.model.name,
        changes: { wall_height_mm: newVal },
        description: `Set wall height to ${newVal} mm`,
      },
    };
  }

  const railMatch = lastMsg.match(/rail\s*(?:length)?\s*(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (railMatch && context.parameters.rail_length_mm !== undefined) {
    const newVal = parseFloat(railMatch[1]);
    return {
      content: `I'll change the rail length to ${newVal} mm.\n\n\`\`\`json\n${JSON.stringify(
        {
          action: 'update_parameters',
          target: context.model.name,
          changes: { rail_length_mm: newVal },
          description: `Set rail length to ${newVal} mm`,
        },
        null,
        2
      )}\n\`\`\`\n\nClick **Apply** to update the model.`,
      action: {
        action: 'update_parameters',
        target: context.model.name,
        changes: { rail_length_mm: newVal },
        description: `Set rail length to ${newVal} mm`,
      },
    };
  }

  // Increase/decrease patterns
  const increaseMatch = lastMsg.match(/(?:increase|add|raise)\s+(.+?)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (increaseMatch) {
    const paramName = findParamKey(increaseMatch[1], context.parameters);
    if (paramName) {
      const delta = parseFloat(increaseMatch[2]);
      const current = context.parameters[paramName] as number;
      const newVal = current + delta;
      return {
        content: `I'll increase ${paramName} from ${current} to ${newVal} mm.\n\n\`\`\`json\n${JSON.stringify(
          {
            action: 'update_parameters',
            target: context.model.name,
            changes: { [paramName]: newVal },
            description: `Increase ${paramName} by ${delta} mm`,
          },
          null,
          2
        )}\n\`\`\`\n\nClick **Apply** to update the model.`,
        action: {
          action: 'update_parameters',
          target: context.model.name,
          changes: { [paramName]: newVal },
          description: `Increase ${paramName} by ${delta} mm`,
        },
      };
    }
  }

  const decreaseMatch = lastMsg.match(/(?:decrease|reduce|shorten|lower)\s+(.+?)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (decreaseMatch) {
    const paramName = findParamKey(decreaseMatch[1], context.parameters);
    if (paramName) {
      const delta = parseFloat(decreaseMatch[2]);
      const current = context.parameters[paramName] as number;
      const newVal = current - delta;
      return {
        content: `I'll decrease ${paramName} from ${current} to ${newVal} mm.\n\n\`\`\`json\n${JSON.stringify(
          {
            action: 'update_parameters',
            target: context.model.name,
            changes: { [paramName]: newVal },
            description: `Decrease ${paramName} by ${delta} mm`,
          },
          null,
          2
        )}\n\`\`\`\n\nClick **Apply** to update the model.`,
        action: {
          action: 'update_parameters',
          target: context.model.name,
          changes: { [paramName]: newVal },
          description: `Decrease ${paramName} by ${delta} mm`,
        },
      };
    }
  }

  // Style changes
  const styleMatch = lastMsg.match(/(?:make it|change to|switch to|use)\s*(minimal|rounded|industrial)/i);
  if (styleMatch && context.parameters.style !== undefined) {
    const newStyle = styleMatch[1].toLowerCase();
    return {
      content: `I'll change the style to "${newStyle}".\n\n\`\`\`json\n${JSON.stringify(
        {
          action: 'update_parameters',
          target: context.model.name,
          changes: { style: newStyle },
          description: `Change style to ${newStyle}`,
        },
        null,
        2
      )}\n\`\`\`\n\nClick **Apply** to update the model.`,
      action: {
        action: 'update_parameters',
        target: context.model.name,
        changes: { style: newStyle },
        description: `Change style to ${newStyle}`,
      },
    };
  }

  // Info queries
  if (lastMsg.includes('show') || lastMsg.includes('current') || lastMsg.includes('what') || lastMsg.includes('dimensions')) {
    const paramList = Object.entries(context.parameters)
      .map(([k, v]) => `  - **${k}**: ${v}`)
      .join('\n');
    const measureList = context.measurements.length
      ? context.measurements.map((m) => `  - ${m.label}: ${m.value} ${m.unit}`).join('\n')
      : '  No measurements taken yet.';

    return {
      content: `**Model: ${context.model.name}**\n\nBounds: ${context.model.bounds_mm.x} x ${context.model.bounds_mm.y} x ${context.model.bounds_mm.z} mm\n\n**Parameters:**\n${paramList}\n\n**Measurements:**\n${measureList}`,
    };
  }

  // Default
  return {
    content: `I can help you modify the model. Try commands like:\n- "Make slot width 11 mm"\n- "Increase wall height by 5 mm"\n- "Shorten the rail by 15 mm"\n- "Change to rounded style"\n- "Show current dimensions"\n\n**Tip:** Add your Anthropic API key in settings for full AI responses.`,
  };
}

function findParamKey(text: string, params: Record<string, number | string | boolean>): string | null {
  const cleaned = text.toLowerCase().replace(/[^a-z]/g, '');
  for (const key of Object.keys(params)) {
    const keyClean = key.toLowerCase().replace(/[^a-z]/g, '');
    if (keyClean.includes(cleaned) || cleaned.includes(keyClean.replace('mm', '').replace('deg', ''))) {
      return key;
    }
  }
  // Fuzzy match on common terms
  const termMap: Record<string, string[]> = {
    slot_width_mm: ['slot', 'width'],
    wall_height_mm: ['wall', 'height', 'support height'],
    rail_length_mm: ['rail', 'length'],
    base_thickness_mm: ['base', 'thickness'],
    support_angle_deg: ['angle', 'support angle'],
    fillet_radius_mm: ['fillet', 'radius', 'round'],
  };
  for (const [key, terms] of Object.entries(termMap)) {
    if (key in params && terms.some((t) => text.toLowerCase().includes(t))) {
      return key;
    }
  }
  return null;
}

function extractAction(content: string): StructuredAction | null {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.action && (parsed.action === 'update_parameters' || parsed.action === 'info')) {
      return parsed as StructuredAction;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}
