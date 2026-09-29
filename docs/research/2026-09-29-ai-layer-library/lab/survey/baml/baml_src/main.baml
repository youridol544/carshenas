generator target {
  output_type "typescript"
  output_dir "../"
  version "0.226.2"
  module_format "esm"
  default_client_mode "async"
}

client<llm> MetisOpenAI {
  provider openai
  options {
    model "gpt-5-mini"
    base_url "https://api.metisai.ir/openai/v1"
    api_key env.METIS_API_KEY
  }
}

client<llm> MetisClaude {
  provider anthropic
  options {
    model "claude-sonnet-4-5"
    base_url "https://api.metisai.ir/anthropic"
    api_key env.METIS_API_KEY
    max_tokens 1000
  }
}

client<llm> MetisGemini {
  provider google-ai
  options {
    model "gemini-2.5-flash"
    base_url "https://api.metisai.ir/v1beta"
    api_key env.METIS_API_KEY
  }
}

enum FuelType {
  PETROL
  CNG
  HYBRID
}

class Listing {
  make string
  modelYear int @assert(plausible_year, {{ this > 1300 and this < 1500 }})
  fuel FuelType?
}

function ExtractListing(text: string) -> Listing {
  client MetisOpenAI
  prompt #"
    Extract the listing.
    {{ ctx.output_format }}
    {{ _.role("user") }}
    {{ text }}
  "#
}

retry_policy Twice {
  max_retries 2
  strategy {
    type constant_delay
    delay_ms 10
  }
}

client<llm> LocalOpenAI {
  provider openai
  retry_policy Twice
  options {
    model "gpt-5-mini"
    base_url env.LOCAL_OPENAI_BASE
    api_key "sk-test"
  }
}

client<llm> LocalClaude {
  provider anthropic
  options {
    model "claude-x"
    base_url env.LOCAL_ANTHROPIC_BASE
    api_key "sk-test"
    max_tokens 100
  }
}

client<llm> MetisClaudeNative {
  provider anthropic
  options {
    model "claude-sonnet-4-5"
    base_url "https://api.metisai.ir/anthropic"
    api_key env.METIS_API_KEY
    max_tokens 1000
    output_config {
      format {
        type "json_schema"
        schema {
          type "object"
          properties {
            make { type "string" }
          }
          required ["make"]
          additionalProperties false
        }
      }
    }
  }
}

client<llm> LocalClaudeStrict {
  provider anthropic
  options {
    model "claude-x"
    base_url env.LOCAL_ANTHROPIC_BASE
    api_key "sk-test"
    max_tokens 100
    finish_reason_allow_list ["end_turn"]
  }
}
