use serde::{Deserialize, Deserializer};

pub fn deserialize_files<'de, D>(deserializer: D) -> Result<Vec<(String, Option<String>)>, D::Error>
where
    D: Deserializer<'de>,
{
    let vec: Vec<Vec<Option<String>>> = Vec::deserialize(deserializer)?;

    vec.into_iter()
        .map(|mut file| {
            if file.is_empty() {
                return Err(serde::de::Error::custom("File entry cannot be empty"));
            } else if file.len() > 2 {
                return Err(serde::de::Error::custom(
                    "File entry can have at most two elements",
                ));
            }

            // 提取第一个元素，并确保它是 Some(String)
            let first_opt = file.remove(0);
            let first = first_opt
                .ok_or_else(|| serde::de::Error::custom("First element cannot be null"))?;

            // 如果有第二个元素，则取出来；否则为 None
            let second = if !file.is_empty() {
                file.remove(0)
            } else {
                None
            };

            Ok((first, second))
        })
        .collect()
}
