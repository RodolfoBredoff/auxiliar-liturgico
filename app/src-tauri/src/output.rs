use std::process::Command;
use std::thread;
use std::time::Duration;

#[tauri::command]
pub fn list_midi_ports() -> Result<Vec<String>, String> {
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        use midir::MidiOutput;
        let midi_out = MidiOutput::new("auxiliar-liturgico").map_err(|e| e.to_string())?;
        let ports = midi_out.ports();
        Ok(ports
            .iter()
            .filter_map(|p| midi_out.port_name(p).ok())
            .collect())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub fn send_midi_pulse(port_name: String, note: u8) -> Result<(), String> {
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        use midir::MidiOutput;
        let midi_out = MidiOutput::new("auxiliar-liturgico").map_err(|e| e.to_string())?;
        let ports = midi_out.ports();
        let port = ports
            .iter()
            .find(|p| {
                midi_out
                    .port_name(p)
                    .map(|n| n == port_name || (port_name.is_empty() && !n.is_empty()))
                    .unwrap_or(false)
            })
            .or_else(|| ports.first())
            .ok_or_else(|| "Nenhuma porta MIDI encontrada (configure rtpMIDI).".to_string())?;

        let mut conn = midi_out
            .connect(port, "auxiliar-out")
            .map_err(|e| e.to_string())?;

        let status = 0x90;
        conn.send(&[status, note, 0x7f]).map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(80));
        conn.send(&[status, note, 0x00]).map_err(|e| e.to_string())?;
        drop(conn);
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (port_name, note);
        Err("MIDI não suportado nesta plataforma.".into())
    }
}

#[tauri::command]
pub fn powerpoint_go_to_slide(slide: i32) -> Result<(), String> {
    if slide < 1 {
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"tell application "Microsoft PowerPoint"
    if not (exists slide show window 1) then error "no_show" number -1
    set v to slide show view of slide show window 1
    set cur to current show position of v
    set targetSlide to {slide}
    if cur < targetSlide then
        repeat while cur < targetSlide
            go to next slide v
            set cur to current show position of v
        end repeat
    else if cur > targetSlide then
        repeat while cur > targetSlide
            go to previous slide v
            set cur to current show position of v
        end repeat
    end if
end tell"#
        );
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            if err.contains("no_show") {
                return Err("PowerPoint não está em modo apresentação.".into());
            }
            return Err(format!("PowerPoint (Mac): {err}"));
        }
        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        let ps = format!(
            r#"
$slide = {slide}
$p = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
$w = $p.SlideShowWindows.Item(1)
$view = $w.View
while ($view.CurrentShowPosition -lt $slide) {{ $view.Next() }}
while ($view.CurrentShowPosition -gt $slide) {{ $view.Previous() }}
"#
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps])
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).into());
        }
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = slide;
        Err("PowerPoint só está automatizado em Mac e Windows.".into())
    }
}
