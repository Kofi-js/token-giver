"use client";
import { ChangeEvent, useEffect, useState } from "react";
import { useAccount } from "@starknet-react/core";
import StepTwo from "./components/StepTwo";
import { InputDateType } from "@/types";
import StepThree from "./components/StepThree";
import Logo from "@/svgs/Logo";
import { CallData } from "starknet";
import {
  BEARER_TOKEN,
  IMPLEMENTATION_HASH,
  REGISTRY_HASH,
  TOKEN_GIVER_Nft_CONTRACT_ADDRESS,
  campaign_contract,
  nft_contract,
  provider
} from "../utils/data";
import Container from "../components/util/Container";
import CreateCampaignLoader from "../components/loading/CreateCampaignLoader";
import { H2 } from "../components/util/Headers";
import RightArrowIcon from "@/svgs/RightArrowIcon";
import { useRouter } from "next/navigation";
import Connect from "../components/Connect";

const Page = () => {
  const router = useRouter();
  const { address } = useAccount();
  const account: any = useAccount();
  const [campaignStep, setCampaignStep] = useState(0);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [campaignUrl, setCampaignUrl] = useState("/");
  const [step, setStep] = useState({
    number: 1,
    text: "First connect your wallet"
  });
  const [inputData, setInputData] = useState<InputDateType>({
    name: "",
    description: "",
    image: null,
    target: "",
    organizer: "",
    beneficiary: "",
    location: ""
  });

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setInputData((prev) => {
      if (
        name === "image" &&
        e.target instanceof HTMLInputElement &&
        e.target.files
      ) {
        return {
          ...prev,
          image: e.target.files[0]
        };
      }
      return {
        ...prev,
        [name]: value
      };
    });
  };

  async function createCampaign() {
    const loadingPopover = document.querySelector(
      "#creatingCampaign"
    ) as HTMLElement;
    // @ts-ignore
    loadingPopover.showPopover();
    document.body.style.overflow = "hidden";

    try {
      setCreatingCampaign(true);
      setLoadingPercentage(10);
      campaign_contract.connect(account.account);
      const last_minted_id = await nft_contract.get_last_minted_id();
      const salt = Math.floor(Math.random() * 9999)
        .toString()
        .padStart(4, "0");

      // CREATE CAMPAIGN -> campaign address (nft)
      const create_campaign_res = await campaign_contract.create_campaign(
        CallData.compile([
          TOKEN_GIVER_Nft_CONTRACT_ADDRESS,
          REGISTRY_HASH,
          IMPLEMENTATION_HASH,
          salt,
          account.address
        ])
      );
      const txnDet = await provider.waitForTransaction(
        create_campaign_res.transaction_hash
      );
      txnDet.isSuccess() && setCampaignStep(1);
      setLoadingPercentage(40);

      /////////////////////////////////////////
      // UPLOAD CAMPAIGN NFT IMAGE TO PINATA
      ////////////////////////////////////////
      if (!inputData.image) {
        alert("No Image selected");
        return;
      }
      const formData = new FormData();
      formData.append("file", inputData.image);

      const image_upload_res = await fetch(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`
          },
          body: formData
        }
      );
      const image_upload_resData = await image_upload_res.json();
      setLoadingPercentage(60);

      //////////////////////////////////
      // CREATE NEW METADATA URI JSON
      //////////////////////////////////
      let tokenId = Number(last_minted_id) + 1;
      let new_metadata = JSON.stringify({
        id: tokenId,
        image: `ipfs://${image_upload_resData.IpfsHash}/`,
        name: inputData.name,
        description: inputData.description,
        target: inputData.target,
        organizer: inputData.organizer,
        beneficiary: inputData.beneficiary,
        location: inputData.location,
        campaign_address:
          txnDet.isSuccess() && txnDet.events.at(1)?.from_address,
        created_at: new Date()
      });
      setCampaignUrl(`/campaign/${address}/${tokenId}`);

      ////////////////////////////////////////////
      // UPLOAD NEW METADATA_URI JSON TO PINATA
      ////////////////////////////////////////////
      const metadata_upload_res = await fetch(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BEARER_TOKEN}`
          },
          body: new_metadata
        }
      );

      const metadata_upload_resData = await metadata_upload_res.json();

      metadata_upload_resData.IpfsHash && setCampaignStep(2);
      setLoadingPercentage(80);

      ///////////////////////////////////////
      // CALL SET_METADATA_URI FUNCTION
      //////////////////////////////////////
      campaign_contract.connect(account.account);
      const set_campaign_metadata_res =
        await campaign_contract.set_campaign_metadata_uri(
          CallData.compile([
            txnDet.isSuccess() && txnDet.events[1].from_address,
            `ipfs://${metadata_upload_resData.IpfsHash}/`
          ])
        );

      setLoadingPercentage(100);
      setCampaignStep(3);
      setTimeout(() => {
        // @ts-ignore
        loadingPopover.hidePopover();
        document.body.style.overflow = "auto";
        setInputData({
          name: "",
          description: "",
          image: null,
          target: "",
          organizer: "",
          beneficiary: "",
          location: ""
        });
        setStep({
          number: 2,
          text: "Tell us about your campaign"
        });
      }, 10000);
    } catch (err) {
      // @ts-ignore
      loadingPopover.hidePopover();
      document.body.style.overflow = "auto";
    } finally {
      setCreatingCampaign(false);
    }
  }

  useEffect(() => {
    if (account.address) {
      setStep(() => {
        return {
          text: "Tell us about your campaign",
          number: 2
        };
      });
    } else {
      setStep(() => {
        return {
          text: "First connect your wallet",
          number: 1
        };
      });
    }
  }, [account.address]);

  return (
    <main className="relative flex min-h-screen justify-between bg-theme-green md:mb-10">
      <Container className="hidden w-[40%] p-4 md:flex md:flex-col">
        <button
          onClick={() => router.push("/")}
          className="flex w-fit items-center self-start justify-self-start text-[1.2em] text-white"
        >
          <span className="inline-block rotate-180 transform text-white">
            <RightArrowIcon />
          </span>
          <span>back</span>
        </button>

        <div className="my-auto">
          <div className="flex flex-col gap-8 p-4">
            <p className="text-[1.5em] font-bold text-white">
              <Logo />
            </p>
            <H2 style="text-theme-yellow">Start your fundraising journey!</H2>

            <div className="flex items-center gap-2 text-white">
              <span className="">
                <span className="mr-2 text-[1.8em]">{step.number}</span>/ 3
              </span>
              <p className="mt-3">{step.text}</p>
            </div>
          </div>
        </div>
      </Container>

      <div className="flex w-full items-center bg-background px-4 py-10 md:w-[60%] md:rounded-tl-[50px] md:shadow-hero-shadow lg:px-20 lg:py-10">
        <Container className="flex flex-col justify-between">
          <Connect />
          <form className="flex flex-col gap-4 md:p-4" action="">
            <h2>Create your campaign</h2>
            <StepTwo
              inputData={inputData}
              handleInputChange={handleInputChange}
              address={account.address}
              step={step}
              setInputData={setInputData}
            />
            <StepThree
              inputData={inputData}
              handleInputChange={handleInputChange}
              address={account.address}
              step={step}
            />
          </form>
          <div
            className={`mt-4 flex md:p-4 ${
              step.number === 2 || step.number === 1
                ? "justify-end"
                : "justify-between"
            }`}
          >
            <button
              disabled={!account.address}
              onClick={() =>
                setStep(() => {
                  return {
                    text: "Tell us about your campaign",
                    number: 2
                  };
                })
              }
              className={`text-[2em] text-theme-green ${
                step.number === 2 || step.number === 1 ? "hidden" : "block"
              } `}
            >
              <span>&lt;</span>
            </button>
            <div className="flex">
              <button
                disabled={
                  !inputData.name || !inputData.description || !inputData.image
                }
                onClick={() =>
                  setStep(() => {
                    return {
                      text: "Tell us about you and your goals",
                      number: 3
                    };
                  })
                }
                className={`w-fit self-end justify-self-end rounded-[10px] bg-theme-green px-6 py-2 text-white ${
                  step.number === 3 ? "hidden" : "block"
                } `}
              >
                Continue
              </button>
              <button
                popoverTarget="creatingCampaign"
                onClick={() => {
                  createCampaign();
                }}
                disabled={
                  !inputData.target ||
                  !inputData.location ||
                  !inputData.organizer ||
                  creatingCampaign
                }
                className={`w-fit self-end justify-self-end rounded-[10px] bg-theme-green px-6 py-2 text-white ${
                  step.number === 3 ? "block" : "hidden"
                } `}
              >
                {creatingCampaign ? "Creating Campaign..." : "Mint Campaign"}
              </button>
            </div>
          </div>
        </Container>
      </div>

      <CreateCampaignLoader
        campaignStep={campaignStep}
        percentage={loadingPercentage}
        url={campaignUrl}
      />

      <div className="absolute bottom-[-64px] left-0 hidden h-[50px] w-full bg-background p-8 md:block"></div>
    </main>
  );
};

export default Page;
