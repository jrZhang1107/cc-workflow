/**
 * CLI Output Converter
 * Converts raw CLI output into structured Intermediate Representation (IR)
 * Supports: Gemini (stream-json), Qwen (stream-json), Codex (json-lines)
 */

/**
 * Output unit types
 * @typedef {'stdout'|'stderr'|'thought'|'agent_message'|'streaming_content'|'tool_call'|'metadata'|'progress'} OutputUnitType
 */

/**
 * @typedef {Object} CliOutputUnit
 * @property {OutputUnitType} type
 * @property {any} content
 * @property {string} timestamp
 */

/**
 * Plain text parser - wraps text in type envelope
 */
class PlainTextParser {
  parse(chunk, streamType) {
    const text = chunk.toString('utf8');
    if (!text) return [];

    return [{
      type: streamType,
      content: text,
      timestamp: new Date().toISOString()
    }];
  }

  flush() {
    return [];
  }
}

/**
 * JSON Lines parser - handles newline-delimited JSON
 * Used by Gemini, Qwen (stream-json) and Codex (--json)
 */
class JsonLinesParser {
  constructor(tool = 'gemini') {
    this.buffer = '';
    this.tool = tool;
  }

  /**
   * Classify non-JSON content
   */
  classifyContent(content, originalType) {
    // CLI progress patterns (filter from final output)
    const progressPatterns = [
      /^Loaded cached credentials/i,
      /^Loading.*\.\.\.$/i,
      /^Initializ(ing|ed)/i,
      /^Connecting/i,
      /^Using model/i,
    ];

    for (const pattern of progressPatterns) {
      if (pattern.test(content.trim())) {
        return 'progress';
      }
    }

    // Error patterns
    const errorPatterns = [
      /^error:/i,
      /^fatal:/i,
      /\bERROR\b/,
      /\bFAILED\b/,
    ];

    if (originalType === 'stderr') {
      for (const pattern of errorPatterns) {
        if (pattern.test(content)) {
          return 'stderr';
        }
      }
    }

    return 'stdout';
  }

  parse(chunk, streamType) {
    const text = chunk.toString('utf8');
    this.buffer += text;

    const units = [];
    const lines = this.buffer.split('\n');

    // Keep last incomplete line in buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try parse as JSON
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Not JSON, classify and wrap
        const effectiveType = this.classifyContent(line, streamType);
        units.push({
          type: effectiveType,
          content: line,
          timestamp: new Date().toISOString()
        });
        continue;
      }

      // Map JSON to IR
      const unit = this.mapJsonToIR(parsed);
      if (unit) units.push(unit);
    }

    return units;
  }

  flush() {
    const units = [];

    if (this.buffer.trim()) {
      try {
        const parsed = JSON.parse(this.buffer.trim());
        const unit = this.mapJsonToIR(parsed);
        if (unit) units.push(unit);
      } catch {
        units.push({
          type: 'stdout',
          content: this.buffer,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.buffer = '';
    return units;
  }

  /**
   * Map JSON to IR type based on tool format
   */
  mapJsonToIR(json) {
    const timestamp = json.timestamp || new Date().toISOString();

    // ========== Gemini/Qwen stream-json format ==========
    // {"type":"init","session_id":"...","model":"..."}
    if (json.type === 'init' && json.session_id) {
      return {
        type: 'metadata',
        content: {
          tool: this.tool,
          sessionId: json.session_id,
          model: json.model,
          raw: json
        },
        timestamp
      };
    }

    // {"type":"message","role":"assistant","content":"...","delta":true}
    if (json.type === 'message' && json.role === 'assistant') {
      return {
        type: json.delta ? 'streaming_content' : 'agent_message',
        content: json.content || '',
        timestamp
      };
    }

    // {"type":"result","status":"success","stats":{...}}
    if (json.type === 'result' && json.stats) {
      return {
        type: 'metadata',
        content: {
          tool: this.tool,
          status: json.status,
          stats: json.stats,
          raw: json
        },
        timestamp
      };
    }

    // {"type":"tool_use","tool_name":"...","parameters":{...}}
    if (json.type === 'tool_use' && json.tool_name) {
      return {
        type: 'tool_call',
        content: {
          action: 'invoke',
          toolName: json.tool_name,
          toolId: json.tool_id,
          parameters: json.parameters
        },
        timestamp
      };
    }

    // {"type":"tool_result","tool_id":"...","output":"..."}
    if (json.type === 'tool_result' && json.tool_id) {
      return {
        type: 'tool_call',
        content: {
          action: 'result',
          toolId: json.tool_id,
          status: json.status,
          output: json.output
        },
        timestamp
      };
    }

    // ========== Codex --json format ==========
    // {"type":"thread.started","thread_id":"..."}
    if (json.type === 'thread.started' && json.thread_id) {
      return {
        type: 'metadata',
        content: {
          tool: 'codex',
          threadId: json.thread_id,
          raw: json
        },
        timestamp
      };
    }

    // {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
    if (json.type === 'item.completed' && json.item) {
      const item = json.item;

      if (item.type === 'agent_message') {
        return {
          type: 'agent_message',
          content: item.text || '',
          timestamp
        };
      }

      if (item.type === 'reasoning') {
        return {
          type: 'thought',
          content: item.text || '',
          timestamp
        };
      }

      if (item.type === 'command_execution') {
        return {
          type: 'tool_call',
          content: {
            action: 'result',
            command: item.command,
            output: item.aggregated_output || item.output
          },
          timestamp
        };
      }
    }

    // {"type":"turn.completed","usage":{...}}
    if (json.type === 'turn.completed' && json.usage) {
      return {
        type: 'metadata',
        content: {
          tool: 'codex',
          usage: json.usage,
          raw: json
        },
        timestamp
      };
    }

    // Unknown format, return as metadata
    return {
      type: 'metadata',
      content: { raw: json },
      timestamp
    };
  }
}

/**
 * Create appropriate parser for tool
 * @param {string} tool - CLI tool name
 * @returns {PlainTextParser|JsonLinesParser}
 */
export function createOutputParser(tool) {
  switch (tool) {
    case 'gemini':
    case 'qwen':
    case 'codex':
      return new JsonLinesParser(tool);
    default:
      return new PlainTextParser();
  }
}

/**
 * Flatten output units to plain text
 * @param {CliOutputUnit[]} units
 * @param {Object} options
 * @returns {string}
 */
export function flattenOutput(units, options = {}) {
  const { includeThoughts = false, includeToolCalls = false } = options;

  return units
    .filter(unit => {
      if (unit.type === 'progress') return false;
      if (unit.type === 'metadata') return false;
      if (unit.type === 'thought' && !includeThoughts) return false;
      if (unit.type === 'tool_call' && !includeToolCalls) return false;
      return true;
    })
    .map(unit => {
      if (typeof unit.content === 'string') return unit.content;
      if (unit.content?.text) return unit.content.text;
      return '';
    })
    .join('');
}

export default { createOutputParser, flattenOutput };
