package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A gateway that moved — the port changed in Settings, or Windows took the
// old one out of reach — leaves every agent magpie wired calling an address
// that answers nothing. Repoint moves the address and nothing else: the
// user's own providers, comments, spacing and line endings are as they were.
func TestRepointMovesOnlyTheAddress(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.toml")
	body := "# my own notes\r\n" +
		"openai_base_url = \"http://127.0.0.1:3425/backend-api/codex\"\r\n" +
		"\r\n" +
		"[model_providers.magpie]\r\n" +
		"base_url = \"http://127.0.0.1:3425/v1\"\r\n" +
		"experimental_bearer_token = \"magpie\"\r\n" +
		"[model_providers.mine]\r\n" +
		"base_url = \"http://127.0.0.1:8080/v1\"\r\n"
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}

	changed, err := RepointFile(path, "http://127.0.0.1:3425", "http://127.0.0.1:23425")
	if err != nil || !changed {
		t.Fatalf("changed=%v err=%v", changed, err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	s := string(got)
	if n := strings.Count(s, "127.0.0.1:23425"); n != 2 {
		t.Fatalf("the address wasn't moved twice (%d):\n%s", n, s)
	}
	if strings.Contains(s, "127.0.0.1:3425") {
		t.Fatalf("the old address is still there:\n%s", s)
	}
	// what isn't magpie's address is untouched, down to the line endings
	if !strings.Contains(s, "http://127.0.0.1:8080/v1") || !strings.Contains(s, "# my own notes\r\n") || !strings.Contains(s, "\r\n\r\n") {
		t.Fatalf("something else in the file changed:\n%q", s)
	}
	if !strings.HasSuffix(s, "\r\n") {
		t.Fatalf("line endings changed:\n%q", s)
	}

	// a file that never held the address isn't written at all
	if again, err := RepointFile(path, "http://127.0.0.1:3425", "http://127.0.0.1:23425"); err != nil || again {
		t.Fatalf("rewrote a file that didn't hold it: changed=%v err=%v", again, err)
	}
}

// Nothing to move, nothing done: a first run has no address remembered, and
// an address that hasn't moved is left alone.
func TestRepointWithNowhereToMove(t *testing.T) {
	for _, c := range [][2]string{
		{"", "http://127.0.0.1:23425"},
		{"http://127.0.0.1:23425", ""},
		{"http://127.0.0.1:23425", "http://127.0.0.1:23425"},
	} {
		if got, trouble := Repoint(c[0], c[1]); got != nil || trouble != nil {
			t.Fatalf("Repoint(%q, %q) = %v, %v, want nothing", c[0], c[1], got, trouble)
		}
	}
}
