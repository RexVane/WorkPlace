package gui

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/yetone/magpie/internal/usage"
)

// purposeKindsOfAsset reads the map out of the generated browser catalog.
// The asset is checked in as LF (.gitattributes says `* text=auto eol=lf`),
// but a Windows checkout or an editor that rewrites line endings must not
// read as a stale catalog: what is compared is the map, not the bytes around
// it, so the carriage returns a `\r\n` file carries are dropped first.
func purposeKindsOfAsset(b []byte) (map[string]usage.PurposeKind, bool) {
	_, data, ok := strings.Cut(string(b), "const REQUEST_KINDS = ")
	if !ok {
		return nil, false
	}
	data = strings.TrimSpace(strings.ReplaceAll(data, "\r\n", "\n"))
	data = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(data), ";"))
	var kinds map[string]usage.PurposeKind
	if json.Unmarshal([]byte(data), &kinds) != nil {
		return nil, false
	}
	return kinds, true
}

func TestPurposeAssetMatchesUsage(t *testing.T) {
	b, err := assets.ReadFile("assets/purposes.js")
	if err != nil {
		t.Fatal(err)
	}
	kinds, ok := purposeKindsOfAsset(b)
	if !ok || !reflect.DeepEqual(kinds, usage.PurposeKinds()) {
		t.Fatal("the browser's purpose catalog is stale: run go generate ./internal/usage")
	}
}

// TestPurposeAssetIgnoresLineEndings holds the comparison above to the map
// alone: the same catalog written with CRLF, or with whitespace after the
// statement, still matches, while a catalog that really lost or gained a kind
// is still caught.
func TestPurposeAssetIgnoresLineEndings(t *testing.T) {
	b, err := assets.ReadFile("assets/purposes.js")
	if err != nil {
		t.Fatal(err)
	}
	want := usage.PurposeKinds()

	for _, tc := range []struct {
		name string
		body string
		want bool
	}{
		{"as checked in", string(b), true},
		{"CRLF", strings.ReplaceAll(string(b), "\n", "\r\n"), true},
		{"trailing spaces", strings.TrimSuffix(string(b), "\n") + "  \n\n", true},
		{"a kind taken out", strings.Replace(string(b), `  "web_search": {`, `  "gone": {`, 1), false},
		{"no statement", "// nothing here\n", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			kinds, ok := purposeKindsOfAsset([]byte(tc.body))
			if got := ok && reflect.DeepEqual(kinds, want); got != tc.want {
				t.Fatalf("purposeKindsOfAsset matched %v, want %v", got, tc.want)
			}
		})
	}
}
