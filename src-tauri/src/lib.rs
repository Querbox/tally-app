use serde::{Deserialize, Serialize};

const GITHUB_TOKEN: &str = env!("TALLY_GITHUB_TOKEN");
const GITHUB_REPO: &str = "Querbox/tally-app";

#[derive(Debug, Serialize, Deserialize)]
struct GitHubIssueRequest {
    title: String,
    body: String,
    labels: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GitHubIssueResponse {
    number: u64,
    html_url: String,
}

#[derive(Debug, Serialize)]
struct FeedbackResult {
    success: bool,
    issue_number: Option<u64>,
    issue_url: Option<String>,
    error: Option<String>,
}

#[tauri::command]
async fn submit_feedback(
    feedback_type: String,
    title: String,
    description: String,
    app_version: String,
) -> Result<FeedbackResult, String> {
    let title = title.trim().to_string();
    let description = description.trim().to_string();

    if title.is_empty() {
        return Ok(FeedbackResult {
            success: false,
            issue_number: None,
            issue_url: None,
            error: Some("Titel darf nicht leer sein".to_string()),
        });
    }

    let labels = match feedback_type.as_str() {
        "feature" => vec!["enhancement".to_string(), "from-app".to_string()],
        "bug" => vec!["bug".to_string(), "from-app".to_string()],
        "feedback" => vec!["feedback".to_string(), "from-app".to_string()],
        _ => vec!["from-app".to_string()],
    };

    let body = format!(
        "{}\n\n---\n*Gesendet aus Tally v{} via In-App Feedback*",
        description, app_version
    );

    let issue = GitHubIssueRequest {
        title,
        body,
        labels,
    };

    let client = reqwest::Client::new();
    let response = client
        .post(format!(
            "https://api.github.com/repos/{}/issues",
            GITHUB_REPO
        ))
        .header("Authorization", format!("Bearer {}", GITHUB_TOKEN))
        .header("User-Agent", "Tally-App")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&issue)
        .send()
        .await
        .map_err(|e| format!("Netzwerkfehler: {}", e))?;

    if response.status().is_success() {
        let issue_response: GitHubIssueResponse = response
            .json()
            .await
            .map_err(|e| format!("Fehler beim Parsen: {}", e))?;

        Ok(FeedbackResult {
            success: true,
            issue_number: Some(issue_response.number),
            issue_url: Some(issue_response.html_url),
            error: None,
        })
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Ok(FeedbackResult {
            success: false,
            issue_number: None,
            issue_url: None,
            error: Some(format!("GitHub API Fehler ({}): {}", status, error_text)),
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            app
                .handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![submit_feedback])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
