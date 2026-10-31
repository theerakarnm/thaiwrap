//! Node-API binding for thaiwrap-core: converts JS values, validates them, maps errors.
use napi::bindgen_prelude::*;
use napi_derive::napi;
use thaiwrap_core::{Measure, Overflow};

/// Options for `wrapThai`. Every field is optional.
#[napi(object)]
pub struct WrapOptions {
    /// How line length is counted. Default `"codeUnits"` (the same as `String.prototype.length`).
    #[napi(ts_type = "'codeUnits' | 'graphemes'")]
    pub measure: Option<String>,
    /// What to do with a single word longer than `maxLength`. Default `"split"`.
    #[napi(ts_type = "'split' | 'keep'")]
    pub overflow: Option<String>,
}

/// Wrap text into lines of at most `maxLength`, breaking between words.
/// A word longer than `maxLength` is cut only where Thai rules allow (or kept whole with
/// `overflow: "keep"`), and no line starts with a Thai vowel or tone mark.
/// @throws {TypeError} if `text` is not a string, `maxLength` is not a number, or `options` has a wrong type.
/// @throws {RangeError} if `maxLength` is not a positive safe integer, or an option has an unknown value.
#[napi(
    catch_unwind,
    ts_args_type = "text: string, maxLength: number, options?: WrapOptions | undefined | null"
)]
pub fn wrap_thai(
    env: Env,
    text: Unknown<'_>,
    max_length: Unknown<'_>,
    options: Option<Unknown<'_>>,
) -> Result<Vec<String>> {
    let text = read_string(&env, &text, "text")?;
    let max_length = read_max_length(&env, &max_length)?;
    let options = to_core_options(&env, read_options(&env, options.as_ref())?)?;
    let ranges = thaiwrap_core::wrap(&text, max_length, &options)
        .map_err(|e| range_error(&env, &e.to_string()))?;
    ranges
        .into_iter()
        .map(|r| {
            text.get(r).map(str::to_owned).ok_or_else(|| {
                Error::new(
                    Status::GenericFailure,
                    "thaiwrap internal error: a line does not end on a character boundary",
                )
            })
        })
        .collect()
}

const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

fn read_string(env: &Env, value: &Unknown<'_>, name: &str) -> Result<String> {
    if value.get_type()? != ValueType::String {
        return Err(type_error(
            env,
            &format!("{name} must be a string, got {}", type_name(value)),
        ));
    }
    // Lossy on purpose: lone surrogates become U+FFFD (D10), whatever bytes the runtime's
    // napi_get_value_string_utf8 produces for them (runtimes may differ).
    let utf8 = value.coerce_to_string()?.into_utf8()?;
    Ok(String::from_utf8_lossy(utf8.as_slice()).into_owned())
}

fn read_max_length(env: &Env, value: &Unknown<'_>) -> Result<usize> {
    if value.get_type()? != ValueType::Number {
        return Err(type_error(
            env,
            &format!("maxLength must be a number, got {}", type_name(value)),
        ));
    }
    let n = value.coerce_to_number()?.get_double()?;
    if let Some(max_length) = max_length_from_f64(n) {
        return Ok(max_length);
    }
    // The engine's own conversion, so the message shows exactly what JS prints (`1e+21`, not 1000...).
    let shown = value.coerce_to_string()?.into_utf8()?.into_owned()?;
    Err(range_error(
        env,
        &format!("maxLength must be a positive integer, got {shown}"),
    ))
}

fn max_length_from_f64(n: f64) -> Option<usize> {
    if !(n.is_finite() && n.fract() == 0.0 && (1.0..=MAX_SAFE_INTEGER).contains(&n)) {
        return None;
    }
    // n is an integer in 1..=2^53-1, so the cast to u64 is exact.
    let n = n as u64;
    Some(usize::try_from(n).unwrap_or(usize::MAX))
}

fn read_options(env: &Env, value: Option<&Unknown<'_>>) -> Result<WrapOptions> {
    let empty = WrapOptions {
        measure: None,
        overflow: None,
    };
    let Some(value) = value else { return Ok(empty) };
    match value.get_type()? {
        ValueType::Undefined | ValueType::Null => return Ok(empty),
        ValueType::Object => {}
        _ => {
            return Err(type_error(
                env,
                &format!("options must be an object, got {}", type_name(value)),
            ))
        }
    }
    let object = value.coerce_to_object()?;
    Ok(WrapOptions {
        measure: read_option(env, &object, "measure")?,
        overflow: read_option(env, &object, "overflow")?,
    })
}

fn read_option(env: &Env, object: &Object<'_>, key: &str) -> Result<Option<String>> {
    let value: Unknown<'_> = object.get_named_property(key)?;
    match value.get_type()? {
        ValueType::Undefined => Ok(None),
        _ => read_string(env, &value, &format!("options.{key}")).map(Some),
    }
}

fn to_core_options(env: &Env, options: WrapOptions) -> Result<thaiwrap_core::WrapOptions> {
    let mut core = thaiwrap_core::WrapOptions::default();
    if let Some(value) = options.measure {
        core.measure = match value.as_str() {
            "codeUnits" => Measure::CodeUnits,
            "graphemes" => Measure::Graphemes,
            // {value:?} prints the value quoted and escapes NUL, which CString (used by throw_range_error) rejects.
            _ => {
                return Err(range_error(
                    env,
                    &format!(
                        r#"options.measure must be "codeUnits" or "graphemes", got {value:?}"#
                    ),
                ))
            }
        };
    }
    if let Some(value) = options.overflow {
        core.overflow = match value.as_str() {
            "split" => Overflow::Split,
            "keep" => Overflow::Keep,
            _ => {
                return Err(range_error(
                    env,
                    &format!(r#"options.overflow must be "split" or "keep", got {value:?}"#),
                ))
            }
        };
    }
    Ok(core)
}

fn type_name(value: &Unknown<'_>) -> &'static str {
    match value.get_type() {
        Ok(ValueType::Undefined) => "undefined",
        Ok(ValueType::Null) => "null",
        Ok(ValueType::Boolean) => "boolean",
        Ok(ValueType::Number) => "number",
        Ok(ValueType::String) => "string",
        Ok(ValueType::Symbol) => "symbol",
        Ok(ValueType::Object) => "object",
        Ok(ValueType::Function) => "function",
        // Without the napi6 feature, BigInt is the only JS type that Node-API reports as Unknown.
        Ok(ValueType::Unknown) => "bigint",
        _ => "an unsupported value",
    }
}

// env.throw_* sets a pending JS exception; returning PendingException tells napi-rs not to
// throw a second (plain Error) on top of it.
fn type_error(env: &Env, message: &str) -> Error {
    match env.throw_type_error(message, None) {
        Ok(()) => Error::from_status(Status::PendingException),
        Err(e) => e,
    }
}

fn range_error(env: &Env, message: &str) -> Error {
    match env.throw_range_error(message, None) {
        Ok(()) => Error::from_status(Status::PendingException),
        Err(e) => e,
    }
}
