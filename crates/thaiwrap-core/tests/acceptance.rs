use thaiwrap_core::{wrap, WrapOptions};

#[test]
fn acceptance_should_wrap_at_words_with_default_options() {
    let text = "กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า";
    let lines: Vec<&str> = wrap(text, 10, &WrapOptions::default())
        .unwrap()
        .into_iter()
        .map(|r| &text[r])
        .collect();
    assert_eq!(lines, ["กระบวนการ", "สื่อสาร", "ส่งมอบ และ", "สร้าง", "คุณค่า"]);
}
