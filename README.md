![Build status](https://github.com/joonas-fi/sadetutka/workflows/Build/badge.svg)

What?
-----

I wanted to display local weather + animated rain map in my home automation dashboard.
There was no clean integration via data layer, so I had to resort to browser-based
scraping (because I didn't want to use an `iframe` either)

This runs on AWS Lambda.

It basically produces these images:

![](https://s3.amazonaws.com/files.function61.com/sadetutka/meteogram.png)

![](https://s3.amazonaws.com/files.function61.com/sadetutka/sadetutka.png)

From data in [https://www.foreca.fi/Finland/Tampere](https://www.foreca.fi/Finland/Tampere)


How?
----

Internally, this uses [chrome-server](https://github.com/function61/chrome-server)
microservice (also runs on Lambda, but it's behind a standard HTTP API).

![](docs/drawing.png)


Why is this public?
-------------------

I shared this not because it's ready-to-use for anybody else, but in the hopes if the
techniques help anybody else.

