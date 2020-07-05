package main

import (
	"bytes"
	"context"
	_ "image/png"
	"io"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/function61/chrome-server/pkg/chromeserverclient"
	"github.com/function61/gokit/aws/lambdautils"
	"github.com/function61/gokit/aws/s3facade"
	"github.com/function61/gokit/ezhttp"
	"github.com/function61/gokit/logex"
	"github.com/function61/gokit/osutil"
)

// defined in script.js
type scriptDataOutput struct {
	FrameUrls    []string `json:"frameUrls"`
	MeteogramUrl string   `json:"meteogramUrl"`
}

func main() {
	if lambdautils.InLambda() {
		// we just assume it's a CloudWatch scheduler trigger so drop input payload
		lambda.StartHandler(lambdautils.NoPayloadAdapter(logic))
		return
	}

	osutil.ExitIfError(logic(osutil.CancelOnInterruptOrTerminate(logex.StandardLogger())))
}

func logic(ctx context.Context) error {
	bucket, err := s3facade.Bucket("files.function61.com", nil, "us-east-1")
	if err != nil {
		return err
	}

	workdir, err := ioutil.TempDir("", "sadetutka-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(workdir)

	script, err := ioutil.ReadFile("script.js")
	if err != nil {
		return err
	}

	chromeServer, err := chromeserverclient.New(
		chromeserverclient.Function61,
		chromeserverclient.TokenFromEnv)
	if err != nil {
		return err
	}

	log.Println("executing scraper")

	scriptOuput := &scriptDataOutput{}
	if _, err := chromeServer.Run(ctx, string(script), scriptOuput, &chromeserverclient.Options{
		ErrorAutoScreenshot: true,
	}); err != nil {
		return err
	}

	localFrameFilenames, err := downloadFilesConcurrently(
		ctx,
		scriptOuput.FrameUrls,
		workdir)
	if err != nil {
		return err
	}

	gifName := filepath.Join(workdir, "sadetutka.gif")

	log.Printf("making %s", gifName)

	if err := createGifFromFrames(gifName, localFrameFilenames); err != nil {
		return err
	}

	log.Println("uploading GIF")

	if err := uploadFile(
		ctx,
		gifName,
		"sadetutka/sadetutka.gif",
		"image/gif",
		bucket,
	); err != nil {
		return err
	}

	log.Println("downloading meteogram")

	meteogram := &bytes.Buffer{}

	res, err := ezhttp.Get(ctx, scriptOuput.MeteogramUrl)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if _, err := io.Copy(meteogram, res.Body); err != nil {
		return err
	}

	log.Println("uploading meteogram")

	return upload(
		ctx,
		bytes.NewReader(meteogram.Bytes()),
		"sadetutka/meteogram.png",
		"image/png",
		bucket)
}
