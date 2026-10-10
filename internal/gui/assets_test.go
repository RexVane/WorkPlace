package gui

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"io/fs"
	"mime"
	"testing"
)

func TestAssetTypesHoldAgainstTheRegistry(t *testing.T) {
	for ext, want := range assetTypes {
		if got := mime.TypeByExtension(ext); got != want {
			t.Errorf("%s served as %q, not %q", ext, got, want)
		}
	}
}

func TestVersionedPageIncludesUsageAssets(t *testing.T) {
	page, err := fs.ReadFile(staticFS(), "index.html")
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"usage/usage-fx.js", "usage/usage-fx.css"} {
		b, err := fs.ReadFile(staticFS(), name)
		if err != nil {
			t.Fatal(err)
		}
		sum := sha256.Sum256(b)
		want := []byte(fmt.Sprintf(`%s?v=%x`, name, sum[:6]))
		if got := versionedPage(page); !bytes.Contains(got, want) {
			t.Errorf("%s has no content version: %s", name, got)
		}
	}
}
